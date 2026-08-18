/**
 * Печать flang → C.
 *
 * Главный тест здесь один и он же единственный осмысленный: **сверка с
 * интерпретатором**. Кодогенератор не имеет права быть «почти правильным»:
 * либо собранная программа на каждом входе даёт то же значение и ту же ошибку
 * (код и текст), что `interpret.mjs`, либо результатам сгенерированного кода
 * нельзя верить вовсе.
 *
 * Поэтому каждая программа проходит полный путь пользователя: печатается в
 * ПУСТОЙ каталог, собирается `gcc -std=c99 -Wall -Wextra -Werror -pedantic`
 * ровно из того, что выдал бэкенд (ни одного файла руками), и запускается
 * настоящим процессом. Ничего не подкладывается из репозитория: если бы
 * рантайм собирался только потому, что лежит рядом, дыра нашлась бы у первого
 * же пользователя, а не здесь.
 *
 * Сетка входов гоняется через прогонщик одним процессом на программу: тысячи
 * точек, одна сборка. Значения ездят размеченным JSON — числа строкой, чтобы
 * NaN, Infinity и −0 доехали без потерь.
 *
 * Набор программ: все модели репозитория через `compat.mjs` (обещание §9
 * SPEC), рекурсия по списку, обход дерева-суммы, взаимная рекурсия, строки на
 * кириллице и суррогатных парах, нарушение постусловия, хвостовая рекурсия на
 * 100 000 шагов и проверка утечек под valgrind.
 */
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"

import { errorCode, INPUT_PARAM } from "../src/compat.mjs"
import { evaluate as interpret, variant } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"
import { ЧАСТИЧНЫЕ } from "../src/failures.mjs"
import { markMeasureGuards } from "../src/totality.mjs"
import { черезГраницу } from "./through-entry.mjs"
import { emitC } from "../src/emit/c.mjs"


const workdir = await mkdtemp(join(tmpdir(), "flang-emit-c-"))
after(async () => {
  await rm(workdir, { recursive: true, force: true })
})

const CFLAGS = ["-std=c99", "-Wall", "-Wextra", "-Werror", "-pedantic"]

let serial = 0

/* ───────────────────── печать, сборка, запуск ───────────────────── */

/** Печатает программу в пустой каталог и собирает ровно то, что напечатано. */
async function build(program, options = {}) {
  serial += 1
  const directory = join(workdir, `p${serial}`)
  await mkdir(directory, { recursive: true })
  const emitted = emitC(program, options)
  for (const file of emitted.files) await writeFile(join(directory, file.path), file.content, "utf8")

  /* В каталоге не должно оказаться ничего, кроме напечатанного. */
  const present = readdirSync(directory).sort()
  assert.deepEqual(present, emitted.files.map((file) => file.path).sort())

  compile(directory, emitted, options.cc ?? "gcc", options.extraFlags ?? [])
  const moduleSource = emitted.files.find((file) => file.path.endsWith(".c") && !file.path.startsWith("flang_"))
  return {
    directory,
    emitted,
    cli: join(directory, "flang_cli"),
    source: moduleSource.content,
    header: emitted.files.find((file) => file.path.endsWith(".h") && !file.path.startsWith("flang_")).content,
  }
}

function compile(directory, emitted, cc, extraFlags) {
  const sources = emitted.files.filter((file) => file.path.endsWith(".c")).map((file) => file.path)
  try {
    execFileSync(cc, [...CFLAGS, ...extraFlags, ...sources, "-o", "flang_cli", "-lm"], {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    assert.fail(`${cc} не собрал напечатанное:\n${error.stderr ?? error.message}`)
  }
}

/** Один процесс на сколько угодно запросов: сборка дорога, запрос дёшев. */
function ask(built, requests) {
  const input = `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`
  const output = execFileSync(built.cli, {
    input,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  })
  const lines = output.split("\n").filter((line) => line.length > 0)
  assert.equal(lines.length, requests.length, "прогонщик обязан ответить на каждый запрос ровно один раз")
  return lines.map((line) => JSON.parse(line))
}

/* ───────────────────── значения на проводе ───────────────────── */

function isVariantLike(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.variant === "string" &&
    typeof value.fields === "object" &&
    value.fields !== null
  )
}

/* Число едет строкой: JSON не знает ни NaN, ни Infinity, ни знака нуля, а
   Object.is их различает — значит различать обязан и провод. */
function encode(value) {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value
  if (typeof value === "number") return { n: Object.is(value, -0) ? "-0" : String(value) }
  if (typeof value === "string") return { s: value }
  if (Array.isArray(value)) return { l: value.map(encode) }
  if (isVariantLike(value)) {
    return { v: value.variant, f: Object.entries(value.fields).map(([key, item]) => [key, encode(item)]) }
  }
  if (typeof value === "object") {
    return { r: Object.entries(value).map(([key, item]) => [key, encode(item)]) }
  }
  throw new Error(`нечего кодировать: ${typeof value}`)
}

function decode(node) {
  if (node === null) return null
  if (typeof node === "boolean") return node
  if (Object.hasOwn(node, "n")) return Number(node.n)
  if (Object.hasOwn(node, "s")) return node.s
  if (Object.hasOwn(node, "l")) return node.l.map(decode)
  if (Object.hasOwn(node, "r")) {
    const record = {}
    for (const [key, item] of node.r) record[key] = decode(item)
    return record
  }
  if (Object.hasOwn(node, "v")) {
    const fields = {}
    for (const [key, item] of node.f ?? []) fields[key] = decode(item)
    return variant(node.v, fields)
  }
  throw new Error(`нечего декодировать: ${JSON.stringify(node)}`)
}

function sameValue(left, right) {
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return Object.is(left, right)
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((item, index) => sameValue(item, right[index]))
  }
  if (isVariantLike(left) || isVariantLike(right)) {
    if (!isVariantLike(left) || !isVariantLike(right)) return false
    return left.variant === right.variant && sameValue(left.fields, right.fields)
  }
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  if (leftKeys.length !== rightKeys.length) return false
  if (!leftKeys.every((key, index) => key === rightKeys[index])) return false
  return leftKeys.every((key) => sameValue(left[key], right[key]))
}

function outcome(run) {
  try {
    return { ok: true, value: run() }
  } catch (error) {
    return { ok: false, code: errorCode(error), message: error instanceof Error ? error.message : String(error) }
  }
}

function sameOutcome(left, right) {
  if (left.ok !== right.ok) return false
  if (left.ok) return sameValue(left.value, right.value)
  /* Код и текст ошибки — часть наблюдаемого поведения: вызывающий отличает
     нарушение свойства от поломки движка именно по ним. */
  return left.code === right.code && left.message === right.message
}

function describeOutcome(result) {
  return result.ok
    ? `значение ${JSON.stringify(result.value) ?? String(result.value)}`
    : `${result.code}: ${result.message}`
}

/**
 * Сверка одной функции на сетке входов одним запуском процесса.
 * Возвращает число сверенных точек: тест обязан не просто «не упасть», но и
 * показать, что сверял хоть что-то.
 */
function compare(program, built, functionName, grid, options = {}) {
  const fn = (program.functions ?? []).find((item) => item.name === functionName)
  assert.ok(fn, `в программе нет функции «${functionName}»`)
  const params = fn.params.map((param) => (typeof param === "string" ? param : param.name))
  const points = grid.map((point) => (Array.isArray(point) ? point : params.map((name) => point[name])))

  const requests = points.map((args) => {
    const request = { fn: functionName, args: args.map(encode) }
    if (options.depth !== undefined) request.depth = String(options.depth)
    return request
  })
  const answers = ask(built, requests)

  points.forEach((args, index) => {
    /* Эталон для прогонщика — `flang run`, а не голый вычислитель: у входа
       извне стоит граница объявленных типов (см. through-entry.mjs). */
    const byInterpreter = черезГраницу(program, functionName, args, options.limits ?? {})
    const answer = answers[index]
    const byEmitted = answer.ok
      ? { ok: true, value: decode(answer.value) }
      : { ok: false, code: answer.code, message: answer.message }
    assert.ok(
      sameOutcome(byInterpreter, byEmitted),
      `«${functionName}» на входе ${JSON.stringify(args) ?? "?"}: интерпретатор дал ${describeOutcome(byInterpreter)}, ` +
        `собранный C дал ${describeOutcome(byEmitted)}`,
    )
  })
  return points.length
}

/* ══════════════════════════ 2. рекурсия по списку ═══════════════════════════ */

/* «Сумма» не хвостовая: результат вызова ещё складывается с головой. Такая
   функция печатается обычной рекурсией C — как и у интерпретатора, глубина
   растёт. */
const listProgram = {
  flang: 1,
  module: "Списки",
  functions: [
    {
      name: "Сумма",
      total: true,
      params: [{ name: "элементы", type: { kind: "list", of: { kind: "number" } } }],
      returns: { kind: "number" },
      body: {
        kind: "match",
        target: { kind: "var", name: "элементы" },
        cases: [
          { pattern: { kind: "empty" }, body: { kind: "literal", value: 0 } },
          {
            pattern: { kind: "cons", head: "голова", tail: "хвост" },
            body: {
              kind: "binary",
              op: "add",
              left: { kind: "var", name: "голова" },
              right: { kind: "call", name: "Сумма", args: [{ kind: "var", name: "хвост" }] },
            },
          },
        ],
      },
    },
    {
      name: "Удвоить",
      total: true,
      params: [{ name: "элементы", type: { kind: "list", of: { kind: "number" } } }],
      returns: { kind: "list", of: { kind: "number" } },
      body: {
        kind: "map",
        over: { kind: "var", name: "элементы" },
        item: "элемент",
        body: {
          kind: "binary",
          op: "mul",
          left: { kind: "var", name: "элемент" },
          right: { kind: "literal", value: 2 },
        },
      },
    },
    {
      name: "Положительные",
      total: true,
      params: [{ name: "элементы", type: { kind: "list", of: { kind: "number" } } }],
      returns: { kind: "list", of: { kind: "number" } },
      body: {
        kind: "filter",
        over: { kind: "var", name: "элементы" },
        item: "элемент",
        body: {
          kind: "binary",
          op: "gt",
          left: { kind: "var", name: "элемент" },
          right: { kind: "literal", value: 0 },
        },
      },
    },
    {
      name: "Свернуть",
      total: true,
      params: [{ name: "элементы", type: { kind: "list", of: { kind: "number" } } }],
      returns: { kind: "number" },
      body: {
        kind: "fold",
        over: { kind: "var", name: "элементы" },
        init: { kind: "literal", value: 1 },
        acc: "накопитель",
        item: "элемент",
        body: {
          kind: "binary",
          op: "mul",
          left: { kind: "var", name: "накопитель" },
          right: { kind: "var", name: "элемент" },
        },
      },
    },
  ],
}

test("рекурсия по списку, отобразить, отфильтровать и свёртка", async (t) => {
  const built = await build(listProgram)
  const lists = [
    [],
    [1],
    [1, 2, 3],
    [-1, 0, 1],
    [0.1, 0.2, 0.3],
    [1e308, 1e308],
    [Number.NaN, 1],
    [-0],
    Array.from({ length: 200 }, (_, index) => index - 100),
    /* Заведомо неверные входы: коды ошибок обязаны совпасть так же, как значения. */
    "не список",
    null,
    [1, "два", 3],
    [[1], [2]],
  ]
  const grid = lists.map((value) => [value])
  let points = 0
  for (const name of ["Сумма", "Удвоить", "Положительные", "Свернуть"]) {
    points += compare(listProgram, built, name, grid)
  }
  t.diagnostic(`сверенных входов: ${points}`)
})

/*
 * Свидетель к мере памяти ниже: тот же проход, но хвост берётся КОПИЕЙ —
 * `отобразить` строит новый список на каждом шаге, и все n копий живы разом,
 * потому что каждая лежит в своём кадре рекурсии.
 *
 * Он здесь не ради сравнения, а чтобы потолок нельзя было принять на слово:
 * проверка, которая не умеет упасть, выглядит ровно как проверка, у которой всё
 * хорошо. Свидетель обязан потолок перейти — n копий по n ячеек стоят n²/2
 * ячеек, то есть 128 МБ на четырёх тысячах против потолка в единицы мегабайт.
 */
const копияИсточник = [
  "функция «Сумма копией»",
  "  принимает элементы: список числа",
  "  возвращает число",
  "  если пусто элементы",
  "    то 0",
  "    иначе (голова элементы) плюс («Сумма копией» от (отобразить (хвост элементы) как э → э))",
].join("\n")

/** Тело функции C от сигнатуры до закрывающей скобки в первом столбце. */
function телоФункции(текст, сигнатура) {
  const начало = текст.indexOf(`${сигнатура} {`)
  assert.notEqual(начало, -1, `в напечатанном рантайме не нашлось «${сигнатура}»`)
  const конец = текст.indexOf("\n}", начало)
  assert.notEqual(конец, -1, `у «${сигнатура}» не нашлось конца`)
  return текст.slice(начало, конец)
}

/**
 * Даёт ли прогонщик ВЕРНЫЙ ответ, когда адресное пространство ограничено
 * `кб` килобайтами. Предел ставит сам тест, поэтому мера не зависит ни от
 * объёма памяти машины, ни от того, чем эта машина ещё занята.
 */
function вмещается(cli, кб, request, ожидание) {
  const run = spawnSync("/bin/sh", ["-c", `ulimit -v ${кб}; exec "$0"`, cli], {
    input: `${JSON.stringify(request)}\n`,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  const строка = (run.stdout ?? "").trim().split("\n")[0] ?? ""
  if (строка === "") return false
  let ответ = null
  try {
    ответ = JSON.parse(строка)
  } catch {
    return false
  }
  return ответ.ok === true && sameValue(decode(ответ.value), ожидание)
}

/**
 * Наименьший бюджет памяти (КиБ), при котором запрос ещё доходит до ВЕРНОГО
 * ответа, — двоичным поиском по пределу `ulimit -v`.
 *
 * Это замер, но не по часам: число выходит целое и одно и то же на загруженной
 * машине и на пустой (замерялось трижды подряд — все три раза 4096 КиБ на
 * пустом списке). Раньше на этом месте стояло время в миллисекундах, и порога
 * по нему поставить было нельзя — на общей машине оно шумит вдвое, — поэтому
 * порога не стояло вовсе, и половина имени теста жила только в диагностике.
 */
function наименьшийБюджетПамяти(cli, request, ожидание) {
  let верх = 1024
  while (!вмещается(cli, верх, request, ожидание)) {
    верх *= 2
    assert.ok(
      верх <= 1 << 23,
      "и восьми гигабайт памяти не хватило: либо аппетит запроса квадратичен, либо запрос не доходит вовсе",
    )
  }
  let низ = верх / 2
  while (верх - низ > Math.max(64, верх / 64)) {
    const середина = Math.floor((низ + верх) / 2)
    if (вмещается(cli, середина, request, ожидание)) верх = середина
    else низ = середина
  }
  return верх
}

test("хвост списка — срез, а не копия: длинный список обходится линейно", async (t) => {
  /* В JS «хвост» копирует, потому что массив нельзя разделить с суффиксом.
     Здесь значения неизменяемы и лежат в арене, поэтому хвост — срез, и
     наблюдаемо это неотличимо: значение то же, а памяти меньше. */
  const built = await build(listProgram)
  assert.match(built.source, /fl_chain_tail\(/u, "хвост обязан браться срезом рантайма")
  const рантайм = built.emitted.files.find((file) => file.path === "flang_runtime.c").content

  /* ДОКАЗАТЕЛЬСТВО, а не замер: у хвоста в напечатанном рантайме нет ни обхода,
     ни копирования — начало сдвигается, массив остаётся чужим. Никакой замер
     этого не даёт: он говорит про один компилятор на одной машине, а эти строки
     — про всякий.

     Проверяется ВСЯ дорога значения, а не первый её шаг: до сегодняшнего дня
     стоял один assert на `fl_chain_tail`, и подделка, в которой `fl_list_slice`
     копировала список через malloc, проходила тест целиком. */
  const хвост = телоФункции(рантайм, "fl_value fl_chain_tail(fl_value value)")
  assert.match(хвост, /return fl_list_slice\(value, 1\);/u, "хвост списка обязан уходить в срез")
  const срез = телоФункции(рантайм, "fl_value fl_list_slice(fl_value list, size_t from)")
  assert.match(
    срез,
    /return fl_list\(list\.as\.list\.items \+ from, list\.as\.list\.count - from\);/u,
    "срез обязан быть сдвигом начала, а не копией",
  )
  const обёртка = телоФункции(рантайм, "fl_value fl_list(const fl_value *items, size_t count)")
  assert.match(обёртка, /value\.as\.list\.items = items;/u, "список обязан брать чужой массив как есть")
  for (const [имя, тело] of [["fl_chain_tail", хвост], ["fl_list_slice", срез], ["fl_list", обёртка]]) {
    assert.doesNotMatch(
      тело,
      /\b(for|while|goto|memcpy|memmove|malloc|calloc|realloc|fl_arena_alloc|fl_list_alloc)\b/u,
      `в ${имя} появился обход или копирование — хвост перестал быть срезом`,
    )
  }

  /* МЕРА — и она проверяет НЕ то же, что проверка выше. Исходник отвечает за
     форму «хвост»; копию мог бы завести и напечатанный код вокруг неё, и
     связывание образца. Отвечает мера, и мера в БАЙТАХ, а не в секундах: арена
     C не отдаёт ничего до конца запроса, поэтому копирующий хвост стоил бы
     16·n²/2 байт — 128 МБ на 4000 элементах и 512 МБ на 8000, — а срез не стоит
     ничего сверх самого списка (замерено: 0,46 КиБ на элемент).

     Потолок растёт ЛИНЕЙНО по n и проверяется на n и на 2n: пройдя оба, проход
     доказал, что его аппетит линеен, — это и есть вторая половина имени. 2 КиБ
     на элемент вчетверо выше измеренного аппетита среза и в шестнадцать раз
     ниже квадрата; между этими числами границу можно провести где угодно. */
  const запрос = (n) => ({
    fn: "Сумма",
    args: [encode(Array.from({ length: n }, (_, index) => index))],
    depth: "20000",
    steps: "100000000",
  })
  const сумма = (n) => (n * (n - 1)) / 2
  const база = наименьшийБюджетПамяти(built.cli, запрос(0), 0)
  assert.ok(база > 1024, `предел ulimit -v не связывает (${база} КиБ на пустом списке): мерить нечем`)
  const потолок = (n) => база + 2 * n

  const бюджет = [4000, 8000].map((n) => наименьшийБюджетПамяти(built.cli, запрос(n), сумма(n)))
  t.diagnostic(`прогонщик сам по себе: ${база} КиБ; 4000 элементов: ${бюджет[0]} КиБ; 8000: ${бюджет[1]} КиБ`)
  t.diagnostic(`на элемент: ${((бюджет[1] - база) / 8000).toFixed(2)} КиБ при потолке 2 КиБ`)
  for (const [номер, n] of [4000, 8000].entries()) {
    assert.ok(
      бюджет[номер] <= потолок(n),
      `проход по ${n} элементам потребовал ${бюджет[номер]} КиБ при потолке ${потолок(n)}: ` +
        "хвост перестал быть срезом, и проход стал квадратичным",
    )
  }

  /* Свидетель: тот же порог, копирующий хвост — и он обязан порог перейти,
     иначе порог ничего не проверяет. И он же обязан быть РАБОЧЕЙ программой:
     свидетель, который не считает суммы вовсе, свидетельствует о своей поломке,
     а не о цене копии. */
  const свидетель = await build(parse(копияИсточник))
  const запросКопией = (n) => ({ ...запрос(n), fn: "Сумма копией" })
  assert.ok(
    вмещается(свидетель.cli, база + 2 * 1024 * 1024, запросКопией(4000), сумма(4000)),
    "свидетель не сосчитал сумму и с двумя гигабайтами: он сломан, а не дорог",
  )
  assert.ok(
    !вмещается(свидетель.cli, потолок(4000), запросКопией(4000), сумма(4000)),
    `свидетель уложился в тот же потолок ${потолок(4000)} КиБ: потолок ничего не проверяет`,
  )
})

/* ══════════════ 2а. «добавить» не трогает старый список ══════════════ */

/**
 * `добавить` в рантайме на C не копирует список: массив выделяется с запасом,
 * и элемент дописывается в запас на месте (`fl_b_dobavit`). Выигрыш огромен —
 * список из n элементов стоил ~16·n² байт неотбираемой памяти, потому что арена
 * не отдаёт ничего до конца вызова, — но цена ошибки здесь не «медленно», а
 * «тихо испорченные данные»: значения flang неизменяемы, и ссылка на список,
 * сохранённая ДО добавления, обязана видеть прежнюю длину и прежние элементы.
 *
 * Поэтому проверяется ровно это, и двумя способами сразу: значения сверяются с
 * интерпретатором (он копирует, и другого поведения у него быть не может) и,
 * отдельно, выписаны в тесте руками — чтобы тест говорил о свойстве, а не
 * только «у обоих одинаково».
 *
 * Опасны три случая, и все три здесь есть:
 *   • два `добавить` к ОДНОМУ значению — вторая ветка обязана уйти на копию,
 *     иначе она затрёт ячейку, уже отданную первой («Разветвление»);
 *   • ссылка на каждый префикс, пока список растёт дальше («Снимки»);
 *   • удлинение каждого такого префикса задним числом, когда массив давно
 *     ушёл вперёд («Ветви»).
 * Длины подобраны так, чтобы перевыделение запаса (он удваивается) попало и
 * внутрь, и на границу.
 */
const appendSource = `модуль «Неизменяемость»

объект «Ход»
  текущий: список числа
  снимки: список список числа

тотальная функция «Разветвление»
  принимает элементы: список числа
  возвращает список список числа
  пусть «с единицей» равно добавить 1 к элементы
  пусть «с двойкой» равно добавить 2 к элементы
  пусть «и тройка» равно добавить 3 к «с единицей»
  пусть «и четвёрка» равно добавить 4 к «с единицей»
  пусть «и пятёрка» равно добавить 5 к «с двойкой»
  [элементы, «с единицей», «с двойкой», «и тройка», «и четвёрка», «и пятёрка»]

тотальная функция «Снимки»
  принимает элементы: список числа
  возвращает список список числа
  пусть итог равно свёртка элементы начиная с (запись «Ход» с текущий равным пустой список и снимки равным пустой список) как ход и эл
    запись «Ход» с текущий равным (добавить эл к ход.текущий) и снимки равным (добавить ход.текущий к ход.снимки)
  добавить итог.текущий к итог.снимки

тотальная функция «Ветви»
  принимает элементы: список числа
  возвращает список список числа
  пусть снимки равно «Снимки» от элементы
  отобразить снимки как снимок → добавить 0 к снимок

тотальная функция «Сколько накопилось»
  принимает элементы: список числа
  возвращает число
  пусть собрано равно свёртка элементы начиная с пустой список как акк и эл → добавить [эл, эл] к акк
  длина собрано

тотальная функция «Разветвление спереди»
  принимает элементы: список числа
  возвращает список список числа
  пусть «с единицей» равно приписать 1 к элементы
  пусть «с двойкой» равно приписать 2 к элементы
  пусть «и тройка» равно приписать 3 к «с единицей»
  пусть «и четвёрка» равно приписать 4 к «с единицей»
  пусть «и пятёрка» равно приписать 5 к «с двойкой»
  [элементы, «с единицей», «с двойкой», «и тройка», «и четвёрка», «и пятёрка»]

тотальная функция «Снимки спереди»
  принимает элементы: список числа
  возвращает список список числа
  пусть итог равно свёртка элементы начиная с (запись «Ход» с текущий равным пустой список и снимки равным пустой список) как ход и эл
    запись «Ход» с текущий равным (приписать эл к ход.текущий) и снимки равным (приписать ход.текущий к ход.снимки)
  приписать итог.текущий к итог.снимки

тотальная функция «Ветви спереди»
  принимает элементы: список числа
  возвращает список список числа
  пусть снимки равно «Снимки спереди» от элементы
  отобразить снимки как снимок → приписать 0 к снимок

тотальная функция «Сколько накопилось спереди»
  принимает элементы: список числа
  возвращает число
  пусть собрано равно свёртка элементы начиная с пустой список как акк и эл → приписать [эл, эл] к акк
  длина собрано
`

test("«добавить» дописывает в запас, но старый список остаётся прежним", async (t) => {
  const program = parse(appendSource)
  const built = await build(program)

  /* Длины вокруг каждого удвоения запаса (4, 8, 16, …) и заведомо длинный
     список, где запас перевыделялся много раз. */
  const lengths = [0, 1, 2, 3, 4, 5, 7, 8, 9, 15, 16, 17, 31, 32, 33, 63, 64, 65, 200, 300]
  const grid = lengths.map((length) => [Array.from({ length }, (_, index) => index + 1)])
  let points = 0
  for (const name of ["Разветвление", "Снимки", "Ветви"]) points += compare(program, built, name, grid)

  /* То же свойство, выписанное явно: первый элемент ответа — исходный список,
     и он обязан быть ровно тем, что пришёл. */
  const [forked] = ask(built, [{ fn: "Разветвление", args: [encode([7, 8])] }])
  assert.equal(forked.ok, true, JSON.stringify(forked))
  assert.deepEqual(
    decode(forked.value),
    [[7, 8], [7, 8, 1], [7, 8, 2], [7, 8, 1, 3], [7, 8, 1, 4], [7, 8, 2, 5]],
    "второе «добавить» к тому же списку затёрло результат первого",
  )

  /* И на длинном списке: каждая ветка — свой префикс плюс ноль, ни один
     префикс не подрос и не съехал. */
  const long = Array.from({ length: 400 }, (_, index) => index + 1)
  const [branches] = ask(built, [{ fn: "Ветви", args: [encode(long)] }])
  assert.equal(branches.ok, true, JSON.stringify(branches).slice(0, 200))
  assert.deepEqual(
    decode(branches.value),
    Array.from({ length: 401 }, (_, index) => [...long.slice(0, index), 0]),
    "префикс изменился после того, как список ушёл вперёд",
  )
  t.diagnostic(`сверенных входов: ${points}`)
})

/*
 * То же свойство и та же тройка опасных случаев — для «приписать».
 *
 * Проверять это отдельно обязательно: у «приписать» в рантайме на C своя
 * половина инварианта. Общая запись запаса считает занятую часть массива
 * полуинтервалом `[head, filled)`, и «приписать» занимает ячейку `head − 1` —
 * значит ошибка здесь выглядела бы не «медленно», а «тихо испорченные данные»,
 * причём в другую сторону, чем у «добавить»: пострадал бы не хвост, а голова
 * списка, на который кто-то ещё смотрит.
 *
 * Разветвление опаснее всего: `приписать 1 к с` и `приписать 2 к с` обязаны
 * дать два независимых списка, потому что вторая ветка уже не начинается на
 * `head` и обязана уйти на копию.
 */
test("«приписать» пишет в запас спереди, но старый список остаётся прежним", async (t) => {
  const program = parse(appendSource)
  const built = await build(program)

  const lengths = [0, 1, 2, 3, 4, 5, 7, 8, 9, 15, 16, 17, 31, 32, 33, 63, 64, 65, 200, 300]
  const grid = lengths.map((length) => [Array.from({ length }, (_, index) => index + 1)])
  let points = 0
  for (const name of ["Разветвление спереди", "Снимки спереди", "Ветви спереди"]) {
    points += compare(program, built, name, grid)
  }

  const [forked] = ask(built, [{ fn: "Разветвление спереди", args: [encode([7, 8])] }])
  assert.equal(forked.ok, true, JSON.stringify(forked))
  assert.deepEqual(
    decode(forked.value),
    [[7, 8], [1, 7, 8], [2, 7, 8], [3, 1, 7, 8], [4, 1, 7, 8], [5, 2, 7, 8]],
    "второе «приписать» к тому же списку затёрло результат первого",
  )

  const long = Array.from({ length: 400 }, (_, index) => index + 1)
  const [branches] = ask(built, [{ fn: "Ветви спереди", args: [encode(long)] }])
  assert.equal(branches.ok, true, JSON.stringify(branches).slice(0, 200))
  assert.deepEqual(
    decode(branches.value),
    /* Снимки идут от самого свежего к пустому: «приписать» кладёт новый снимок
       в начало, а сам снимок — это первые (400 − i) элементов, перевёрнутые,
       потому что «текущий» тоже собирался приписыванием. */
    Array.from({ length: 401 }, (_, index) => [0, ...long.slice(0, 400 - index).reverse()]),
    "префикс изменился после того, как список ушёл вперёд",
  )
  t.diagnostic(`сверенных входов: ${points}`)
})

test("список из 200 000 элементов собирается «добавить» в 512 МБ", async (t) => {
  /* Мера, а не ощущение — и мера, не зависящая от машины: предел ставит сам
     тест. «Сколько накопилось» делает ровно то, на чём стоял лексер: на каждом
     шаге выделяет значение и дописывает его в накопитель, то есть между двумя
     «добавить» арена успевает выдать что-то ещё.
     Прежний «добавить» копировал список целиком, а арена не отдаёт ничего до
     конца запроса: 16·200000² — это 640 ГБ, и в предел он не уложился бы,
     промахнувшись на шесть порядков. Нынешний тратит около 4n ячеек на массив
     плюс сами значения — десятки мегабайт. Между этими числами можно провести
     границу где угодно; 512 МБ выбрано так, чтобы её не двигал ни аллокатор,
     ни разрядность указателя. */
  const program = parse(appendSource)
  const built = await build(program)
  const request = JSON.stringify({ fn: "Сколько накопилось", args: [encode(Array.from({ length: 200_000 }, (_, i) => i))] })
  const run = spawnSync("/bin/sh", ["-c", `ulimit -v 524288; exec "$0"`, built.cli], {
    input: `${request}\n`,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  assert.equal(run.status, 0, `прогонщик не ответил: ${run.stderr}`)
  const answer = JSON.parse(run.stdout.trim())
  assert.equal(answer.ok, true, `200 000 «добавить» не уложились в 512 МБ: ${JSON.stringify(answer)}`)
  assert.equal(decode(answer.value), 200_000)
  t.diagnostic("200 000 «добавить» с выделением на каждом шаге уложились в 512 МБ")
})

/*
 * ── СТОРОЖ ПРОТИВ ВОЗВРАТА КВАДРАТА ПАМЯТИ ────────────────────────────────
 *
 * Тот же замер, что у «добавить», и та же мера — БАЙТЫ, а не миллисекунды:
 * предел ставит сам тест (`ulimit -v`), поэтому число не зависит ни от машины,
 * ни от того, кто ещё на ней считает. Тест миллисекунд на общей машине не
 * значит ничего, и в этом файле такой уже есть — «стоимость взятия по номеру»
 * собирает времена и не утверждает по ним НИЧЕГО; повторять это нельзя.
 *
 * ЧТО ИМЕННО СТЕРЕЖЁТСЯ. «Приписать» обязано брать запас спереди и удваивать
 * его, то есть тратить на список из n элементов около 4n ячеек. Стоит ему снова
 * копировать список на каждом вызове — а именно так приписывание в начало
 * выражалось до появления формы, свёрткой по `добавить`, — и цена становится
 * 16·n²/2 байт неотбираемой арены: для 200 000 это 320 ГБ, то есть промах мимо
 * предела на шесть порядков. Между этими числами границу можно провести где
 * угодно; 512 МБ выбрано тем же доводом, что у соседнего теста.
 *
 * Между двумя «приписать» здесь нарочно выделяется значение (`[эл, эл]`):
 * продлить последнюю выдачу арены вперёд нельзя вовсе, поэтому запас обязан
 * браться заранее, а не «если повезёт, что массив последний».
 */
test("список из 200 000 элементов собирается «приписать» в 512 МБ", async (t) => {
  const program = parse(appendSource)
  const built = await build(program)
  const request = JSON.stringify({
    fn: "Сколько накопилось спереди",
    args: [encode(Array.from({ length: 200_000 }, (_, i) => i))],
  })
  const run = spawnSync("/bin/sh", ["-c", `ulimit -v 524288; exec "$0"`, built.cli], {
    input: `${request}\n`,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  assert.equal(run.status, 0, `прогонщик не ответил: ${run.stderr}`)
  const answer = JSON.parse(run.stdout.trim())
  assert.equal(answer.ok, true, `200 000 «приписать» не уложились в 512 МБ: ${JSON.stringify(answer)}`)
  assert.equal(decode(answer.value), 200_000)
  t.diagnostic("200 000 «приписать» с выделением на каждом шаге уложились в 512 МБ")
})

/* ══════════════════════════ 3. дерево-сумма ═══════════════════════════ */

const treeProgram = {
  flang: 1,
  module: "Деревья",
  types: [
    {
      kind: "sum",
      name: "Дерево",
      variants: [
        { name: "Лист", fields: [{ name: "значение", type: { kind: "number" } }] },
        {
          name: "Узел",
          fields: [
            { name: "левое", type: { kind: "sum", name: "Дерево" } },
            { name: "правое", type: { kind: "sum", name: "Дерево" } },
          ],
        },
        { name: "Пустое", fields: [] },
      ],
    },
  ],
  functions: [
    {
      name: "Сумма дерева",
      total: true,
      params: [{ name: "дерево", type: { kind: "sum", name: "Дерево" } }],
      returns: { kind: "number" },
      body: {
        kind: "match",
        target: { kind: "var", name: "дерево" },
        cases: [
          { pattern: { kind: "variant", name: "Пустое", bind: {} }, body: { kind: "literal", value: 0 } },
          {
            pattern: { kind: "variant", name: "Лист", bind: { "значение": "значение" } },
            body: { kind: "var", name: "значение" },
          },
          {
            pattern: { kind: "variant", name: "Узел", bind: { "левое": "левое", "правое": "правое" } },
            body: {
              kind: "binary",
              op: "add",
              left: { kind: "call", name: "Сумма дерева", args: [{ kind: "var", name: "левое" }] },
              right: { kind: "call", name: "Сумма дерева", args: [{ kind: "var", name: "правое" }] },
            },
          },
        ],
      },
    },
    {
      name: "Удвоить дерево",
      total: true,
      params: [{ name: "дерево", type: { kind: "sum", name: "Дерево" } }],
      returns: { kind: "sum", name: "Дерево" },
      body: {
        kind: "match",
        target: { kind: "var", name: "дерево" },
        cases: [
          {
            pattern: { kind: "variant", name: "Лист", bind: { "значение": "значение" } },
            body: {
              kind: "construct",
              variant: "Лист",
              fields: {
                "значение": {
                  kind: "binary",
                  op: "mul",
                  left: { kind: "var", name: "значение" },
                  right: { kind: "literal", value: 2 },
                },
              },
            },
          },
          {
            pattern: { kind: "variant", name: "Узел", bind: { "левое": "л", "правое": "п" } },
            body: {
              kind: "construct",
              variant: "Узел",
              fields: {
                "левое": { kind: "call", name: "Удвоить дерево", args: [{ kind: "var", name: "л" }] },
                "правое": { kind: "call", name: "Удвоить дерево", args: [{ kind: "var", name: "п" }] },
              },
            },
          },
          { pattern: { kind: "any" }, body: { kind: "construct", variant: "Пустое", fields: {} } },
        ],
      },
    },
  ],
}

test("обход дерева-суммы: конструкторы вариантов и разбор дискриминанта", async (t) => {
  const built = await build(treeProgram)
  /* Роль в имени («вариант Лист» → derevya_variant_list) — не украшение: у C
     одно пространство имён, и вариант, одноимённый с функцией, давал бы один
     идентификатор на два объявления. На ядре FTS это ровно так и случилось:
     «Значение операнда» там и вариант суммы, и функция вычислителя. */
  assert.match(
    built.header,
    /fl_status derevya_variant_list\(/u,
    "конструктор варианта «Лист» обязан быть объявлен с ролью в имени",
  )
  assert.match(built.source, /fl_variant_is\([a-z_0-9]+, "Узел"\)/u, "разбор — это проверка дискриминанта")

  const лист = (n) => variant("Лист", { "значение": n })
  const узел = (l, r) => variant("Узел", { "левое": l, "правое": r })
  const глубокое = (depth) => (depth === 0 ? лист(1) : узел(глубокое(depth - 1), лист(depth)))

  const grid = [
    [variant("Пустое", {})],
    [лист(5)],
    [узел(лист(1), лист(2))],
    [узел(узел(лист(1), лист(2)), узел(лист(3), лист(4)))],
    [глубокое(500)],
    /* Разбор без подходящего случая и обращение к отсутствующему полю. */
    [variant("Лист", {})],
    [42],
    [null],
    [{ "значение": 1 }],
  ]
  const points = compare(treeProgram, built, "Сумма дерева", grid) +
    compare(treeProgram, built, "Удвоить дерево", grid)
  t.diagnostic(`сверенных входов: ${points}`)
})

/* ══════════════════════════ 4. взаимная рекурсия ═══════════════════════════ */

const mutualProgram = {
  flang: 1,
  module: "Чётность",
  functions: [
    {
      name: "Чётное",
      params: [{ name: "н", type: { kind: "number" } }],
      returns: { kind: "boolean" },
      body: {
        kind: "if",
        cond: { kind: "binary", op: "lte", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 0 } },
        then: { kind: "literal", value: true },
        else: {
          kind: "call",
          name: "Нечётное",
          args: [{ kind: "binary", op: "sub", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 1 } }],
        },
      },
    },
    {
      name: "Нечётное",
      params: [{ name: "н", type: { kind: "number" } }],
      returns: { kind: "boolean" },
      body: {
        kind: "if",
        cond: { kind: "binary", op: "lte", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 0 } },
        then: { kind: "literal", value: false },
        else: {
          kind: "call",
          name: "Чётное",
          args: [{ kind: "binary", op: "sub", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 1 } }],
        },
      },
    },
  ],
}

test("взаимная рекурсия совпадает с интерпретатором и держит постоянный стек", async (t) => {
  const built = await build(mutualProgram)
  assert.match(built.source, /fl_trampoline\(/u, "взаимная хвостовая рекурсия печатается через батут")
  assert.match(built.source, /bounce->next = /u, "хвостовой вызов соседа — отскок, а не кадр стека")

  const grid = [-1, 0, 1, 2, 3, 10, 11, 999, 1000].map((value) => [value])
  const points = compare(mutualProgram, built, "Чётное", grid) +
    compare(mutualProgram, built, "Нечётное", grid)

  /* depth = 16 — доказательство, что вызовы действительно хвостовые: без
     переиспользования кадра оба движка упёрлись бы в предел на 17-м шаге. */
  const limits = { maxSteps: 100_000_000, maxDepth: 16 }
  assert.equal(interpret(mutualProgram, "Чётное", [50_000], limits), true)
  const [even, odd] = ask(built, [
    { fn: "Чётное", args: [encode(50_000)], depth: "16" },
    { fn: "Нечётное", args: [encode(50_001)], depth: "16" },
  ])
  assert.deepEqual([even.ok, decode(even.value)], [true, true])
  assert.deepEqual([odd.ok, decode(odd.value)], [true, true])
  t.diagnostic(`сверенных входов: ${points}; 50 000 взаимных хвостовых шагов при пределе глубины 16`)
})

/* ══════════════════════════ 5. хвостовая рекурсия на 100 000 шагов ═══════════ */

/* Ключевой тест слоя. Интерпретатор переиспользует кадр возврата, поэтому
   считает 100 000 шагов в постоянной глубине. Напечатанная «в лоб» рекурсия C
   переполнила бы стек — именно поэтому хвостовой самовызов идёт в `for (;;)`. */
const countdownProgram = {
  flang: 1,
  module: "Отсчёт",
  functions: [
    {
      name: "Отсчёт",
      params: [
        { name: "н", type: { kind: "number" } },
        { name: "накопитель", type: { kind: "number" } },
      ],
      returns: { kind: "number" },
      body: {
        kind: "if",
        cond: { kind: "binary", op: "lte", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 0 } },
        then: { kind: "var", name: "накопитель" },
        else: {
          kind: "call",
          name: "Отсчёт",
          args: [
            { kind: "binary", op: "sub", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 1 } },
            { kind: "binary", op: "add", left: { kind: "var", name: "накопитель" }, right: { kind: "var", name: "н" } },
          ],
        },
      },
    },
  ],
}

test("хвостовой самовызов развёрнут в цикл: 100 000 шагов проходят", async (t) => {
  const built = await build(countdownProgram)
  assert.match(built.source, /for \(;;\) \{/u, "хвостовой самовызов обязан стать циклом")
  assert.match(built.source, /^ +continue;$/mu, "цикл обязан замыкаться на continue, а не на рекурсию")
  assert.doesNotMatch(built.source, /FL_TRY\(otschyot_otschyot\(/u, "самовызова остаться не должно")

  const expected = (100_000 * 100_001) / 2
  /* depth = 8 — доказательство хвостовой природы вызова: без переиспользования
     кадра оба движка упёрлись бы в предел на девятом шаге. */
  const byInterpreter = interpret(countdownProgram, "Отсчёт", [100_000, 0], { maxSteps: 100_000_000, maxDepth: 8 })
  assert.equal(byInterpreter, expected)
  const [answer] = ask(built, [{ fn: "Отсчёт", args: [encode(100_000), encode(0)], depth: "8" }])
  assert.equal(answer.ok, true, `собранный C не сосчитал 100 000 шагов: ${JSON.stringify(answer)}`)
  assert.equal(decode(answer.value), expected)

  const grid = [-1, 0, 1, 2, 7, 1000].map((value) => [value, 0])
  const points = compare(countdownProgram, built, "Отсчёт", grid, { limits: { maxSteps: 10_000_000 } })
  t.diagnostic(`100 000 шагов пройдено обоими движками; дополнительно сверено входов: ${points}`)
})

/*
 * Линейное «добавить».
 *
 * Наивная реализация копировала список целиком на каждом шаге: накопление в
 * цикле стоило O(n²) времени и, поскольку арена ничего не отдаёт обратно,
 * 16·n²/2 байт памяти — 20 ГБ на пятидесяти тысячах.
 *
 * Прежде тест на этом и стоял: раз 20 ГБ, значит наивное «добавить» не дойдёт
 * вовсе. Померено — доходит: на машине с полутысячей гигабайт подделка, у
 * которой запас отключён и каждое «добавить» копирует, дала верный ответ за 43
 * секунды вместо 0,43. Слово «линейно» в имени держалось на предположении о
 * чужой машине, а не на проверке, и предположение оказалось ложным.
 *
 * Поэтому предел ставит сам тест: `ulimit -v`, растущий ЛИНЕЙНО по n, и замер
 * на n и на 2n. Килобайт на элемент — в двадцать раз выше измеренного аппетита
 * запаса (0,05 КиБ на элемент) и в четыреста раз ниже квадрата.
 */
const accumulateSource = [
  "модуль «Накопление»",
  "",
  "функция «Копить»",
  "  принимает n: число, акк: список числа",
  "  возвращает список числа",
  "  если n не больше 0",
  "    то акк",
  "    иначе «Копить» от (n минус 1) и (добавить n к акк)",
  "",
  "функция «Сколько»",
  "  принимает n: число",
  "  возвращает число",
  "  длина («Копить» от n и пустой список)",
].join("\n")

/*
 * Свидетель: то же накопление, но с копией накопителя на каждом шаге —
 * `отобразить` строит новый список, и продлевать в нём нечего. Он обязан
 * потолок перейти: без него потолок ничего не проверяет, а проверка, которая не
 * умеет упасть, выглядит ровно как проверка, у которой всё хорошо.
 */
const accumulateWitnessSource = [
  "модуль «Накопление копией»",
  "",
  "функция «Копить копией»",
  "  принимает n: число, акк: список числа",
  "  возвращает список числа",
  "  если n не больше 0",
  "    то акк",
  "    иначе «Копить копией» от (n минус 1) и (добавить n к (отобразить акк как э → э))",
  "",
  "функция «Сколько копией»",
  "  принимает n: число",
  "  возвращает число",
  "  длина («Копить копией» от n и пустой список)",
].join("\n")

test("«добавить» в цикле линейно: 50 000 элементов доходят в потолок, растущий линейно", async (t) => {
  const program = parse(accumulateSource)
  const built = await build(program)

  /* Значение прежде всего: продление на месте не имеет права менять результат. */
  const points = compare(program, built, "Сколько", [[0], [1], [2], [10], [1000]], {
    limits: { maxSteps: 100_000_000 },
  })

  const запрос = (n) => ({ fn: "Сколько", args: [encode(n)], steps: "100000000" })
  const база = наименьшийБюджетПамяти(built.cli, запрос(0), 0)
  assert.ok(база > 1024, `предел ulimit -v не связывает (${база} КиБ на нуле элементов): мерить нечем`)
  const потолок = (n) => база + n

  const бюджет = [25_000, 50_000].map((n) => наименьшийБюджетПамяти(built.cli, запрос(n), n))
  t.diagnostic(`прогонщик сам по себе: ${база} КиБ; 25 000 элементов: ${бюджет[0]} КиБ; 50 000: ${бюджет[1]} КиБ`)
  t.diagnostic(`на элемент: ${((бюджет[1] - база) / 50_000).toFixed(3)} КиБ при потолке 1 КиБ; сверено входов: ${points}`)
  for (const [номер, n] of [25_000, 50_000].entries()) {
    assert.ok(
      бюджет[номер] <= потолок(n),
      `накопление ${n} элементов потребовало ${бюджет[номер]} КиБ при потолке ${потолок(n)}: ` +
        "«добавить» перестало продлевать на месте и снова копирует",
    )
  }

  const свидетель = await build(parse(accumulateWitnessSource))
  const запросКопией = (n) => ({ fn: "Сколько копией", args: [encode(n)], steps: "100000000" })
  assert.ok(
    вмещается(свидетель.cli, база + 1024 * 1024, запросКопией(2500), 2500),
    "свидетель не накопил и с гигабайтом: он сломан, а не дорог",
  )
  assert.ok(
    !вмещается(свидетель.cli, потолок(2500), запросКопией(2500), 2500),
    `свидетель уложился в тот же потолок ${потолок(2500)} КиБ: потолок ничего не проверяет`,
  )
})

test("внутренний цикл не перехватывает continue хвостового самовызова", async () => {
  /* `отфильтровать` печатается циклом `for`, а хвостовой самовызов — как
     `continue`. Если бы `continue` оказался внутри цикла коллекции, функция
     молча зациклилась бы на первом же элементе. */
  const program = {
    flang: 1,
    module: "Цикл в цикле",
    functions: [
      {
        name: "Свести",
        params: [{ name: "элементы" }, { name: "итог" }],
        body: {
          kind: "match",
          target: { kind: "var", name: "элементы" },
          cases: [
            { pattern: { kind: "empty" }, body: { kind: "var", name: "итог" } },
            {
              pattern: { kind: "cons", head: "г", tail: "х" },
              body: {
                kind: "let",
                name: "положительные",
                value: {
                  kind: "filter",
                  over: { kind: "var", name: "х" },
                  item: "э",
                  body: { kind: "binary", op: "gt", left: { kind: "var", name: "э" }, right: { kind: "literal", value: 0 } },
                },
                in: {
                  kind: "call",
                  name: "Свести",
                  args: [
                    { kind: "var", name: "положительные" },
                    { kind: "binary", op: "add", left: { kind: "var", name: "итог" }, right: { kind: "var", name: "г" } },
                  ],
                },
              },
            },
          ],
        },
      },
    ],
  }
  const built = await build(program)
  compare(program, built, "Свести", [
    [[], 0],
    [[1, 2, 3], 0],
    [[1, -2, 3], 0],
    [[-1, -2], 100],
    [Array.from({ length: 300 }, (_, index) => index + 1), 0],
    ["не список", 0],
  ])
})

/* ══════════════════════════ 6. постусловия ═══════════════════════════ */

/**
 * Программа с нарушаемым постусловием — собрана AST, а не разобрана из текста.
 *
 * Раньше она приезжала из модели `.fts` через мост, и сверялась с эталоном FTS:
 * «код и текст обязаны совпасть с ядром дословно». Эталон вынесен из
 * репозитория (тег `fts-pered-udaleniem`), и сверять стало не с чем.
 *
 * Само утверждение при этом никуда не делось и осталось проверяемым: код и
 * текст постусловия едут в AST ДАННЫМИ, значит в напечатанном C они обязаны
 * стоять литералами, а не выводиться из знания, зашитого в бэкенд. Код взят
 * нарочно посторонний — такой, какого бэкенд знать не может ниоткуда, кроме
 * этого AST.
 */
const АВТОРСКИЙ_КОД = "POSTUSLOVIE_AVTORA"
const АВТОРСКИЙ_ТЕКСТ = "нарушено свойство «Неотрицательно» функции «Только положительное»"

const violatingProgram = {
  flang: 1,
  module: "Проверка",
  types: [{ kind: "record", name: "Вход", fields: [{ name: "сумма", type: { kind: "number" } }] }],
  functions: [{
    name: "Только положительное",
    total: true,
    params: [{ name: INPUT_PARAM, type: { kind: "record", name: "Вход" } }],
    returns: { kind: "number" },
    body: {
      kind: "let",
      name: "результат0",
      value: { kind: "literal", value: 0 },
      in: {
        kind: "let",
        name: "результат1",
        value: {
          kind: "if",
          cond: {
            kind: "binary",
            op: "gte",
            left: { kind: "field", target: { kind: "var", name: INPUT_PARAM }, field: "сумма" },
            right: { kind: "literal", value: -1000 },
          },
          then: { kind: "field", target: { kind: "var", name: INPUT_PARAM }, field: "сумма" },
          else: { kind: "var", name: "результат0" },
        },
        in: { kind: "var", name: "результат1" },
      },
    },
    postconditions: [{
      name: "Неотрицательно",
      bind: "результат",
      expr: {
        kind: "binary",
        op: "gte",
        left: { kind: "var", name: "результат" },
        right: { kind: "literal", value: 0 },
      },
      code: АВТОРСКИЙ_КОД,
      message: АВТОРСКИЙ_ТЕКСТ,
    }],
  }],
}

test("нарушение постусловия: авторский код и текст едут в C литералами", async () => {
  const program = violatingProgram
  const built = await build(program)

  /* Код и текст едут в AST данными — значит и в C они литералы, а не знание,
     зашитое в бэкенд. Знать этот код бэкенду неоткуда: он посторонний. */
  assert.match(built.source, new RegExp(`"${АВТОРСКИЙ_КОД}"`, "u"))

  const [answer] = ask(built, [{ fn: "Только положительное", args: [encode({ "сумма": -5 })] }])
  assert.equal(answer.ok, false)
  assert.equal(answer.code, АВТОРСКИЙ_КОД)
  assert.equal(answer.message, АВТОРСКИЙ_ТЕКСТ, "текст постусловия обязан доехать дословно")

  /* И то же самое — интерпретатором: обе стороны обязаны отказать одинаково. */
  const наИнтерпретаторе = outcome(() => interpret(program, "Только положительное", { [INPUT_PARAM]: { "сумма": -5 } }))
  assert.equal(наИнтерпретаторе.ok, false)
  assert.equal(наИнтерпретаторе.code, АВТОРСКИЙ_КОД)

  const grid = [-5, -1, 0, 1, 5, -1001].map((value) => ({ [INPUT_PARAM]: { "сумма": value } }))
  compare(program, built, "Только положительное", grid)
})

test("постусловие без кода даёт FLANG_PROPERTY, не признак — FLANG_TYPE", async () => {
  const program = {
    flang: 1,
    module: "Свойства",
    functions: [
      {
        name: "Значение",
        params: [{ name: "х", type: { kind: "number" } }],
        returns: { kind: "number" },
        body: { kind: "var", name: "х" },
        postconditions: [
          {
            name: "Неотрицательно",
            bind: "результат",
            expr: {
              kind: "binary",
              op: "gte",
              left: { kind: "var", name: "результат" },
              right: { kind: "literal", value: 0 },
            },
          },
        ],
      },
      {
        name: "Кривое",
        params: [{ name: "х", type: { kind: "number" } }],
        returns: { kind: "number" },
        body: { kind: "var", name: "х" },
        postconditions: [{ name: "Не признак", expr: { kind: "literal", value: 1 }, bind: "результат" }],
      },
    ],
  }
  const built = await build(program)
  compare(program, built, "Значение", [[1], [0], [-1]])
  compare(program, built, "Кривое", [[1], [0]])

  const [broken, wrong] = ask(built, [
    { fn: "Значение", args: [encode(-1)] },
    { fn: "Кривое", args: [encode(1)] },
  ])
  assert.equal(broken.code, "FLANG_PROPERTY")
  assert.equal(broken.message, "нарушено свойство «Неотрицательно» функции «Значение»")
  assert.equal(wrong.code, "FLANG_TYPE")
})

test("функция с постусловием не получает хвостовой оптимизации — как в интерпретаторе", async () => {
  const program = {
    flang: 1,
    module: "Постусловие и хвост",
    functions: [
      {
        name: "Счёт",
        params: [{ name: "н", type: { kind: "number" } }],
        returns: { kind: "number" },
        body: {
          kind: "if",
          cond: { kind: "binary", op: "lte", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 0 } },
          then: { kind: "literal", value: 0 },
          else: {
            kind: "call",
            name: "Счёт",
            args: [{ kind: "binary", op: "sub", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 1 } }],
          },
        },
        postconditions: [
          {
            name: "Неотрицательно",
            bind: "результат",
            expr: {
              kind: "binary",
              op: "gte",
              left: { kind: "var", name: "результат" },
              right: { kind: "literal", value: 0 },
            },
          },
        ],
      },
    ],
  }
  const built = await build(program)
  assert.doesNotMatch(built.source, /for \(;;\)/u, "постусловие запрещает разворот в цикл")
  compare(program, built, "Счёт", [[0], [1], [5], [50]])
})

/* ══════════════════════════ 7. предел глубины ═══════════════════════════ */

test("нехвостовая рекурсия глубже предела даёт FLANG_RECURSION_LIMIT у обоих движков", async () => {
  /* У интерпретатора переполнение стека невозможно (стек в куче), у C —
     возможно и означает падение процесса. Поэтому счётчик глубины обязателен,
     и его код с текстом обязаны совпасть с интерпретатором. */
  const built = await build(listProgram)
  const long = Array.from({ length: 40 }, (_, index) => index)
  const points = compare(listProgram, built, "Сумма", [[long]], {
    depth: 20,
    limits: { maxDepth: 20, maxSteps: 10_000_000 },
  })
  assert.equal(points, 1)

  const [answer] = ask(built, [{ fn: "Сумма", args: [encode(long)], depth: "20" }])
  assert.equal(answer.code, "FLANG_RECURSION_LIMIT")
  assert.match(answer.message, /^функция «Сумма» превысила предел глубины вызовов \(20\) на глубине 21$/u)
})

/* ══════════════════════════ 8. строковые формы ═══════════════════════════ */

function builtinFn(name, builtin, params) {
  return {
    name,
    total: true,
    params: params.map((param) => ({ name: param })),
    body: { kind: "builtin", name: builtin, args: params.map((param) => ({ kind: "var", name: param })) },
  }
}

const stringProgram = {
  flang: 1,
  module: "Строки",
  functions: [
    builtinFn("Длина", "длина", ["т"]),
    builtinFn("Символ", "символ", ["и", "т"]),
    builtinFn("Подстрока", "подстрока", ["т", "с", "по"]),
    builtinFn("Соединить", "соединить", ["а", "б"]),
    builtinFn("Разделить", "разделить", ["т", "р"]),
    builtinFn("Символы", "символы", ["т"]),
    builtinFn("Код символа", "код символа", ["т"]),
    builtinFn("Содержит", "содержит", ["т", "ч"]),
    builtinFn("Начинается", "начинается с", ["т", "п"]),
    builtinFn("К числу", "к числу", ["т"]),
    builtinFn("К строке", "к строке", ["з"]),
    builtinFn("Пусто", "пусто", ["з"]),
    builtinFn("Голова", "голова", ["с"]),
    builtinFn("Хвост", "хвост", ["с"]),
    builtinFn("Элемент", "элемент", ["и", "с"]),
    builtinFn("Добавить", "добавить", ["э", "с"]),
    builtinFn("Приписать", "приписать", ["э", "с"]),
    builtinFn("Остаток", "остаток от", ["а", "б"]),
    builtinFn("Процент", "процентов от", ["п", "з"]),
    /*
     * Образцы по СТРОКЕ: `пусто` и `голова и хвост` разбирают её так же, как
     * список. Функция написана AST вручную, а не через builtinFn, потому что
     * проверяет не встроенную форму, а сам разбор: у строки голова — одна
     * КОДОВАЯ ТОЧКА, и на «😀😀» рантайм, режущий по единицам UTF-16 или по
     * байтам, развалит суррогатную пару. Сверка идёт с интерпретатором, так что
     * расхождение поймается само.
     */
    {
      name: "Развернуть",
      total: true,
      params: [{ name: "т", type: { kind: "string" } }],
      returns: { kind: "string" },
      body: {
        kind: "match",
        target: { kind: "var", name: "т" },
        cases: [
          { pattern: { kind: "empty" }, body: { kind: "literal", value: "" } },
          {
            pattern: { kind: "cons", head: "г", tail: "х" },
            body: {
              kind: "binary",
              op: "concat",
              left: { kind: "call", name: "Развернуть", args: [{ kind: "var", name: "х" }] },
              right: { kind: "var", name: "г" },
            },
          },
        ],
      },
    },
  ],
}

/* Кириллица и суррогатные пары: длина обязана считаться в кодовых точках,
   иначе «мир 🌍» окажется длиной 6 (UTF-16) или 8 (UTF-8), а не 5. */
const texts = ["", "привет", "мир 🌍", "ёжик", "a", "😀😀", "\u{1F600}абв", "  42  ", "3.5e2", "не число", "да",
  "  7  ", "ЁЖИК"]
const indices = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 1.5, 100]

/*
 * Стоимость взятия по номеру — вопрос, который нельзя решить чтением кода.
 *
 * Форма `элемент N в СПИСОК` обещает ЗНАЧЕНИЕ, а не стоимость: у восьми целей
 * разные структуры данных, и «быстро» верно не для всех. Проход по номеру
 * сверху вниз делает ровно n взятий, поэтому время всего прохода — это n·(цена
 * одного взятия). Удвоив n, получаем ответ прямо: время выросло вдвое —
 * взятие постоянное; вчетверо — взятие линейное.
 *
 * Проход хвостовой, поэтому глубина стека в измерение не входит.
 */
const indexCostProgram = {
  flang: 1,
  module: "Стоимость",
  functions: [
    {
      name: "Сумма по номеру",
      total: true,
      params: [
        { name: "элементы", type: { kind: "list", of: { kind: "number" } } },
        { name: "н", type: { kind: "number" } },
        { name: "акк", type: { kind: "number" } },
      ],
      returns: { kind: "number" },
      body: {
        kind: "if",
        cond: { kind: "binary", op: "lte", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 0 } },
        then: { kind: "var", name: "акк" },
        else: {
          kind: "call",
          name: "Сумма по номеру",
          args: [
            { kind: "var", name: "элементы" },
            { kind: "binary", op: "sub", left: { kind: "var", name: "н" }, right: { kind: "literal", value: 1 } },
            {
              kind: "binary",
              op: "add",
              left: { kind: "var", name: "акк" },
              right: {
                kind: "builtin",
                name: "элемент",
                args: [{ kind: "var", name: "н" }, { kind: "var", name: "элементы" }],
              },
            },
          ],
        },
      },
    },
  ],
}

/*
 * Свидетель: тот же проход, но взятие написано ОБХОДОМ на самом языке, звено за
 * звеном. Он здесь не для сравнения скоростей, а чтобы порог ниже нельзя было
 * принять на слово: проверка, которая не умеет упасть, выглядит ровно как
 * проверка, у которой всё хорошо. Свидетель обязан её порог перейти.
 *
 * `хвост` в C — срез за постоянное время (`fl_list_slice`), а не копия, поэтому
 * дороговизна обхода тут честная: n шагов на одно взятие, а не n копирований.
 */
const обходИсточник = [
  "функция «Элемент обходом»",
  "  принимает н: число, элементы: список числа",
  "  возвращает число",
  "  если н не больше 1",
  "    то голова элементы",
  "    иначе «Элемент обходом» от (н минус 1) и (хвост элементы)",
  "",
  "функция «Сумма обходом»",
  "  принимает элементы: список числа, н: число, акк: число",
  "  возвращает число",
  "  если н не больше 0",
  "    то акк",
  "    иначе «Сумма обходом» от элементы и (н минус 1) и (акк плюс («Элемент обходом» от н и элементы))",
].join("\n")

/**
 * Наименьший бюджет шагов, при котором запрос ещё доходит, — двоичным поиском по
 * бюджету напечатанного прогонщика.
 *
 * Это замер, но не по часам: число выходит целое и одно и то же на загруженной
 * машине и на пустой. Раньше здесь стояло время в миллисекундах, и порога по
 * нему поставить было нельзя — на общей машине оно шумит вдвое, — поэтому порога
 * не стояло вовсе, и утверждение «удвоение n удваивает время» жило только в
 * имени теста.
 *
 * Сам факт, что граница НАХОДИТСЯ, доказывает, что счётчик шагов в C работает:
 * иначе запрос доходил бы при любом бюджете и поиск не сошёлся бы.
 */
function минимумШагов(проходит) {
  let низ = 1
  let верх = 1
  while (!проходит(верх)) {
    низ = верх
    верх *= 2
    assert.ok(верх < 1e9, "бюджет шагов ушёл за миллиард: проход не доходит вовсе")
  }
  while (верх - низ > 1) {
    const середина = Math.floor((низ + верх) / 2)
    if (проходит(середина)) верх = середина
    else низ = середина
  }
  return верх
}

test("стоимость взятия по номеру: массив в C, значит удвоение n удваивает работу", async (t) => {
  const built = await build(indexCostProgram)
  assert.match(built.source, /fl_b_element\(/u, "взятие по номеру обязано печататься вызовом формы")

  /* ДОКАЗАТЕЛЬСТВО, а не замер: у формы в рантайме нет обхода вовсе — номер
     превращается в подстрочный индекс массива. Никакой замер этого не даёт: он
     говорит про один компилятор на одной машине, а эти три строки — про всякий.
     Сменят массив на звенья — упадёт здесь и сразу, а не замедлится молча. */
  const рантайм = readFileSync(new URL("../src/emit/c/flang_runtime.c", import.meta.url), "utf8")
  const тело = /fl_status fl_b_element\([^)]*\)\s*\{([\s\S]*?)\n\}/u.exec(рантайм)?.[1]
  assert.ok(тело !== undefined, "в flang_runtime.c не нашлось тела fl_b_element")
  assert.match(тело, /list\.as\.list\.items\[/u, "взятие обязано быть подстрочным индексом массива")
  assert.doesNotMatch(тело, /\b(for|while|goto)\b|->next/u, "во взятии по номеру появился обход — форма перестала быть постоянной")

  /* ЗАМЕР в шагах — и он проверяет НЕ то же, что проверка выше, поэтому стоят
     обе. Счётчик шагов считает витки самой программы и внутрь формы не смотрит:
     обход, спрятанный в рантайме, он не увидит (его видит проверка выше, по
     исходнику). Зато он видит то, чего не видит исходник, — что проход по n
     номерам стоит n витков, а не n·n: то есть взятие происходит ВНУТРИ витка, а
     не разложено обходом на самом языке. Свидетель ниже показывает, во что
     обошёлся бы второй случай: вчетверо на удвоении вместо вдвое. */
  const шагиФормы = (длина) => {
    const список = Array.from({ length: длина }, (_, номер) => номер + 1)
    return минимумШагов((бюджет) => {
      try {
        const [ответ] = ask(built, [
          { fn: "Сумма по номеру", args: [encode(список), encode(длина), encode(0)], depth: "8", steps: String(бюджет) },
        ])
        return ответ.ok === true && decode(ответ.value) === (длина * (длина + 1)) / 2
      } catch {
        return false
      }
    })
  }
  const форма = [шагиФормы(2000), шагиФормы(4000)]
  const ростФормы = форма[1] / форма[0]

  /* Значение прежде всего: постоянная цена ничего не стоит, если ответ неверен.
     Сверяется на входе вдесятеро больше того, на котором мерились шаги. */
  const n = 40_000
  const начало = Date.now()
  const [ответ] = ask(built, [
    { fn: "Сумма по номеру", args: [encode(Array.from({ length: n }, (_, номер) => номер + 1)), encode(n), encode(0)], depth: "8" },
  ])
  const мс = Date.now() - начало
  assert.equal(ответ.ok, true, JSON.stringify(ответ))
  assert.equal(decode(ответ.value), (n * (n + 1)) / 2)

  const свидетель = await build(parse(обходИсточник))
  const шагиОбхода = (длина) => {
    const список = Array.from({ length: длина }, (_, номер) => номер + 1)
    return минимумШагов((бюджет) => {
      try {
        const [ответ] = ask(свидетель, [
          { fn: "Сумма обходом", args: [encode(список), encode(длина), encode(0)], depth: "16", steps: String(бюджет) },
        ])
        return ответ.ok === true && decode(ответ.value) === (длина * (длина + 1)) / 2
      } catch {
        return false
      }
    })
  }
  const обход = [шагиОбхода(500), шагиОбхода(1000)]
  const ростОбхода = обход[1] / обход[0]

  t.diagnostic(`формой: ${форма[0]} шагов на 2000 номерах, ${форма[1]} на 4000 — рост ×${ростФормы.toFixed(2)}`)
  t.diagnostic(`обходом: ${обход[0]} шагов на 500, ${обход[1]} на 1000 — рост ×${ростОбхода.toFixed(2)}`)
  t.diagnostic(`формой на ${n} номерах: ${мс} мс — время печатается, но не утверждается: оно шумит`)

  assert.ok(
    ростФормы < 2.5,
    `удвоение n подняло работу формы в ${ростФормы.toFixed(2)} раза (${форма[0]} → ${форма[1]}): ` +
      "взятие по номеру перестало быть постоянным",
  )
  assert.ok(
    ростОбхода > 3.5,
    `свидетель вырос всего в ${ростОбхода.toFixed(2)} раза (${обход[0]} → ${обход[1]}): ` +
      "порог выше нечем перейти, значит он ничего не проверяет",
  )
})

test("строковые формы: кириллица, суррогатные пары и границы индексов", async (t) => {
  const built = await build(stringProgram)
  let points = 0

  points += compare(stringProgram, built, "Длина", [...texts, [1, 2, 3], [], 42, null].map((value) => [value]))

  const symbolGrid = []
  for (const index of indices) for (const text of texts) symbolGrid.push([index, text])
  symbolGrid.push([1, 42], [null, "абв"])
  points += compare(stringProgram, built, "Символ", symbolGrid)

  const subGrid = []
  for (const text of texts) for (const from of [0, 1, 2, 3]) for (const to of [0, 1, 2, 3, 6, 100]) subGrid.push([text, from, to])
  points += compare(stringProgram, built, "Подстрока", subGrid)

  points += compare(stringProgram, built, "Соединить", [
    ["мир", " 🌍"],
    ["", ""],
    [["а", "б"], "-"],
    [["а", 1], "-"],
    [[], "-"],
    [["🌍"], "🌍"],
    [1, "а"],
    ["а", 1],
  ])
  points += compare(stringProgram, built, "Разделить", [["а,б,в", ","], ["", ","], ["абв", ""], ["🌍-🌍", "-"], [1, ","], ["ааа", "аа"]])
  /* «символы» обязана делить по кодовым точкам: на «мир 🌍» это 5 элементов, а
     не 6 (единицы UTF-16) и не 8 (байты UTF-8). Комбинирующий знак остаётся
     отдельным элементом — это кодовая точка, а не графема, и в Elixir легко
     ошибиться, взяв String.graphemes. */
  points += compare(stringProgram, built, "Символы", [
    [""], ["a"], ["привет"], ["мир 🌍"], ["😀😀"], ["\u{1F600}абв"], ["e\u0301"], [42], [null], [["а"]],
  ])
  /* «код символа» обязана дать КОДОВУЮ ТОЧКУ, а не единицу UTF-16 и не байт:
     на «😀» это 128512, а не 55357 (старший суррогат) и не 240 (первый байт
     UTF-8). Берётся первый символ, поэтому «😀абв» даёт то же число, что «😀».
     Пустая строка, не строка и список — отказы, и тексты их обязаны совпасть с
     вычислителем дословно, а не «по смыслу». */
  points += compare(stringProgram, built, "Код символа", [
    [""], ["a"], ["Я"], ["привет"], ["😀"], ["😀абв"], ["\u{1F600}"], ["e\u0301"], ["\u0301e"], [42], [null], [["а"]],
  ])
  points += compare(stringProgram, built, "Содержит", [["привет", "иве"], ["мир 🌍", "🌍"], [[1, 2], 2], [[1, 2], 3], [1, 2], ["", ""]])
  points += compare(stringProgram, built, "Начинается", [["привет", "при"], ["", ""], ["🌍x", "🌍"], [1, "а"]])
  points += compare(stringProgram, built, "К числу", [...texts, "0", "-0", "1e3", "Infinity", "0x10", "+5", "1.", ".5", "1e", "1e999"].map((value) => [value]))
  /* «к строке» от признака обязано дать «да»/«нет», а не true/false. */
  points += compare(stringProgram, built, "К строке", [true, false, null, 0, -0, Number.NaN, Infinity, -Infinity, 1e21, 1e-7, 0.1, "уже строка", [1]].map((value) => [value]))
  points += compare(stringProgram, built, "Пусто", [[""], ["а"], [[]], [[1]], [42], [null]])
  points += compare(stringProgram, built, "Голова", [[[]], [[1, 2]], ["строка"], [null]])
  points += compare(stringProgram, built, "Хвост", [[[]], [[1, 2]], ["строка"]])
  /* «элемент N в СПИСОК»: сетка номеров та же, что у «символ», и по той же
     причине — индексация у форм одна. Проверяются обе границы, дробный и
     отрицательный номер, пустой список, не-список и не-число: тексты отказов
     обязаны совпасть с вычислителем дословно, а не «по смыслу». */
  const списки = [[], [1], [1, 2, 3], ["а", "б"], [[1], [2]]]
  const сеткаЭлемента = []
  for (const номер of indices) for (const список of списки) сеткаЭлемента.push([номер, список])
  сеткаЭлемента.push([1, "строка"], [1, 42], [null, [1]], [1, null])
  points += compare(stringProgram, built, "Элемент", сеткаЭлемента)
  points += compare(stringProgram, built, "Добавить", [[1, []], [1, [2]], [1, "строка"]])
  points += compare(stringProgram, built, "Приписать", [[1, []], [1, [2]], [1, "строка"]])
  points += compare(stringProgram, built, "Остаток", [[7, 3], [7, 0], [-7, 3], [7.5, 2], ["a", 1]])
  /* Проценты: порядок (процент / 100) * значение виден на этих числах. */
  points += compare(stringProgram, built, "Процент", [[10, 10000.1], [20, 1 / 3], [5, 1e308], [0, 0], ["a", 1]])
  /* Разбор строки образцами: пустая, один символ, суррогатная пара, а также
     не-строки — у них ни один случай не подходит, и отказ обязан совпасть. */
  points += compare(stringProgram, built, "Развернуть",
    [...texts, ["а", "б"], [], 42, null].map((value) => [value]))

  const answers = ask(built, [
    { fn: "К строке", args: [encode(true)] },
    { fn: "К строке", args: [encode(false)] },
    { fn: "К строке", args: [encode(null)] },
    { fn: "Длина", args: [encode("мир 🌍")] },
    { fn: "Символ", args: [encode(5), encode("мир 🌍")] },
  ])
  assert.deepEqual(answers.map((answer) => decode(answer.value)), ["да", "нет", "ничто", 5, "🌍"])
  t.diagnostic(`сверенных входов: ${points}`)
})

test("нулевая индексация строк включается опцией и остаётся согласованной", async () => {
  const built = await build(stringProgram, { indexBase: 0 })
  const grid = []
  for (const index of indices) for (const text of texts) grid.push([index, text])
  compare(stringProgram, built, "Символ", grid, { limits: { indexBase: 0 } })
})

/* ══════════════════════════ 9. семантика чисел и равенства ═══════════════════ */

test("порядок вычисления строго слева направо: первая ошибка — левая", async () => {
  const program = {
    flang: 1,
    module: "Порядок",
    functions: [
      {
        name: "Сложить",
        params: [{ name: "а" }, { name: "б" }],
        body: {
          kind: "binary",
          op: "add",
          left: { kind: "builtin", name: "голова", args: [{ kind: "var", name: "а" }] },
          right: { kind: "builtin", name: "хвост", args: [{ kind: "var", name: "б" }] },
        },
      },
    ],
  }
  const built = await build(program)
  compare(program, built, "Сложить", [
    [[], []],
    [[1], []],
    [[], [1]],
    [[1], [2]],
    ["не список", []],
  ])
})

test("деление на ноль даёт Infinity и NaN, равенство — Object.is", async () => {
  const program = {
    flang: 1,
    module: "Числа",
    functions: [
      {
        name: "Делить",
        params: [{ name: "а" }, { name: "б" }],
        body: { kind: "binary", op: "div", left: { kind: "var", name: "а" }, right: { kind: "var", name: "б" } },
      },
      {
        name: "Равны",
        params: [{ name: "а" }, { name: "б" }],
        body: { kind: "binary", op: "eq", left: { kind: "var", name: "а" }, right: { kind: "var", name: "б" } },
      },
    ],
  }
  const built = await build(program)
  compare(program, built, "Делить", [[1, 0], [-1, 0], [0, 0], [1, 2], [-0, 1], [1, -0]])

  const values = [0, -0, Number.NaN, 1, "1", true, null, [1, 2], [1, 2, 3], { "а": 1 }, { "а": 1, "б": 2 },
    variant("Лист", { "значение": 1 }), variant("Лист", { "значение": 2 }), variant("Узел", {})]
  const grid = []
  for (const left of values) for (const right of values) grid.push([left, right])
  const points = compare(program, built, "Равны", grid)

  const [nan, zero] = ask(built, [
    { fn: "Равны", args: [encode(Number.NaN), encode(Number.NaN)] },
    { fn: "Равны", args: [encode(0), encode(-0)] },
  ])
  assert.equal(decode(nan.value), true, "NaN обязан быть равен NaN")
  assert.equal(decode(zero.value), false, "0 не равен −0")
  assert.ok(points > 100)
})

/* ══════════════════════════ 10. настоящий исходник flang ═══════════════════ */

const flangSource = `модуль «Счёт»

объект «Позиция»
  цена: число
  название: строка

тип «Токен»
  вариант Слово содержит текст: строка
  вариант Конец

тотальная функция «Длина»
  принимает элементы: список числа
  возвращает число
  разбор элементы
    случай пусто
      то 0
    случай голова и хвост
      то 1 плюс «Длина» от хвост

функция «Итого»
  принимает позиции: список «Позиция»
  возвращает число
  свёртка позиции начиная с 0 как сумма и поз: сумма плюс поз.цена

функция «Показать»
  принимает т: «Токен»
  возвращает строка
  разбор т
    случай Слово содержит текст как слово
      то слово
    случай Конец
      то "конец"
`

test("исходник flang через настоящий парсер собирается и совпадает с интерпретатором", async (t) => {
  const program = parse(flangSource)
  const built = await build(program)
  assert.match(built.header, /Функция flang «Длина»/u)
  assert.match(built.header, /Запись FTS «Позиция»/u)

  let points = compare(program, built, "Длина", [
    [[]],
    [[1, 2, 3]],
    [Array.from({ length: 150 }, (_, index) => index)],
    ["не список"],
    [null],
  ])

  const позиция = (цена, название) => ({ "цена": цена, "название": название })
  points += compare(program, built, "Итого", [
    [[]],
    [[позиция(10, "а")]],
    [[позиция(10, "а"), позиция(2.5, "б")]],
    [[позиция("дорого", "а")]],
    [[{ "название": "без цены" }]],
    ["не список"],
  ])

  points += compare(program, built, "Показать", [
    [variant("Слово", { "текст": "привет" })],
    [variant("Конец", {})],
    [variant("Слово", {})],
    [42],
    [null],
    ["строка"],
  ])
  t.diagnostic(`сверенных входов: ${points}`)
})

test("сторож меры: отказ у собранного C дословно тот же, что у интерпретатора", async (t) => {
  /* Доказательство по мере верно для вещественных чисел, а числа flang —
     IEEE-754 double: `н минус 1` при большом |н| равен н, спуск не идёт, и
     `тотальная` обещала бы завершение там, где его нет. Понижение перед
     печатью ставит на доказанном мерой аргументе проверку убывания
     (`src/defunc.mjs`), а вычислитель зовёт то же понижение — значит отказ у
     них обязан совпасть КОДОМ И ТЕКСТОМ, а не «по смыслу». Ради этого
     совпадения сторож и выражен постусловием: код и текст едут в AST данными,
     и оба движка читают одно поле.

     Сетка — не выдумка: 2⁵⁴+4 и 1e308 это входы, где шаг ничего не меняет;
     ±∞ и NaN — там же по другой причине; 0, 1, 7 и 2.5 — обычный спуск,
     который сторож обязан пропустить неотличимо от программы без него. */
  const program = markMeasureGuards(parse(`модуль «Счёт»

тотальная функция «До нуля»
  принимает н: число
  возвращает число
  если н не больше 0
    то 0
    иначе «До нуля» от (н минус 1)
`))
  const built = await build(program)
  assert.match(built.source, /FLANG_MEASURE/u, "сторож не доехал до напечатанного C")

  const points = compare(program, built, "До нуля", [
    [0], [1], [7], [2.5], [-3],
    [18014398509481988], [1e308], [Infinity], [-Infinity], [NaN],
  ])
  t.diagnostic(`сверенных входов: ${points}`)
})

/* ═════════ 10б. сторож ОБЪЯВЛЕННОЙ меры: 98 мест корпуса из ста ════════════ */

/**
 * Программа, чьё завершение доказано ОБЪЯВЛЕННОЙ мерой, — Евклид.
 *
 * Сторожей меры понижение ставит ДВА, и это два разных сторожа, а не один с
 * настройками (`src/defunc.mjs`): `renderGuard` — постоянный шаг, одно
 * постусловие; `renderDescentGuard` — объявленная мера, ТРИ постусловия и
 * параметр типа. Выше проверен первый, и мест в корпусе у него два из ста:
 * `node flang/scripts/proof-ledger.mjs` считает 2 функции «постоянным шагом» на
 * 2 места сторожа и 64 функции «объявленной мерой» на 98 мест в 44 файлах.
 * Девяносто восемь мест из ста до сегодня не проверял у целей никто.
 *
 * Евклид взят не для красоты: `а остаток от б` от дробного аргумента даёт
 * дробную меру, а убывающая дробная цепочка (0.618, 0.382, 0.236 …) не
 * кончается вовсе — ровно то, что ловит третье постусловие и чего у сторожа
 * постоянного шага нет.
 */
const descentSource = `модуль «Евклид»

тотальная функция «НОД»
  принимает а: число, б: число
  возвращает число
  убывает б
  если б равен 0
    то а
    иначе «НОД» от б и (а остаток от б)
`

/**
 * Сетка объявленной меры: семь исправных спусков и десять входов, на которых
 * не выполняется ровно одно из трёх условий.
 *
 * Она же у остальных семи целей, и намеренно та же: сторож один на восемь
 * целей, значит и входы, на которых он обязан сработать, обязаны быть одни.
 */
const descentGrid = [
  /* Спуск идёт: сторож обязан пропустить их неотличимо от программы без него. */
  [1071, 462], [12, 18], [0, 0], [5, 0], [7, 1], [1, 0.5], [1e308, 7],
  /* Мера перестала быть целой: цепочка убывает и не кончается. */
  [1071.5, 462], [1071, 462.5], [10, 3.5], [2, 1e-300],
  /* Мера не убыла: ±∞ и NaN сравнение не проходят. */
  [1, Infinity], [Infinity, 3], [NaN, 3], [1, NaN], [10, -3],
  /* Мера ушла ниже нуля: остаток от отрицательного отрицателен. */
  [-10, 3],
]

/** Сколько раз слово `FLANG_MEASURE` встречается во всём напечатанном. */
function упоминанийМеры(program) {
  const весь = emitC(program).files.map((file) => file.content).join("")
  return (весь.match(/FLANG_MEASURE/gu) ?? []).length
}

test("сторож объявленной меры ПОЯВЛЯЕТСЯ в напечатанном C всеми тремя условиями", () => {
  /* Главная сверка двусторонняя, и этим слепа: снятая отметка теряется ОБЕИМИ
     сторонами разом — интерпретатор зовёт то же понижение. Здесь довод весомее,
     чем у сторожа постоянного шага: условий ТРИ, живут они в общем понижении, и
     снятие любого теряют обе стороны. Убери проверку целости — интерпретатор и
     собранный C согласно закрутят Евклида на дробной мере, сверка останется
     зелёной, а обещание «тотальная» станет ложным. Поэтому проверяется
     ПОЯВЛЕНИЕ, и по тексту на условие. */
  assert.equal(упоминанийМеры(parse(descentSource)), 0,
    "у голого разбора сторожа объявленной меры нет вовсе — иначе улика ниже ничего не значит")
  assert.equal(упоминанийМеры(markMeasureGuards(parse(descentSource))), 3,
    "у сторожа объявленной меры три постусловия — по одному на условие")

  const весь = emitC(markMeasureGuards(parse(descentSource))).files.map((file) => file.content).join("")
  for (const условие of [/не убыла/u, /ушла ниже нуля/u, /перестала быть целой/u]) {
    assert.match(весь, условие, `условие сторожа не доехало до напечатанного C: ${условие}`)
  }
})

test("сторож объявленной меры: отказ у собранного C дословно тот же, что у интерпретатора", async (t) => {
  const program = markMeasureGuards(parse(descentSource))
  const built = await build(program)
  assert.match(built.source, /FLANG_MEASURE/u, "сторож объявленной меры не доехал до напечатанного C")

  const points = compare(program, built, "НОД", descentGrid)

  /* Отказ обязан ПРИЙТИ С МАШИНЫ, а не только совпасть, и по всем трём
     условиям: совпадение отказов двух движков, взявших текст из одного поля
     AST, доказывает согласие, а не срабатывание.

     ВХОД «не убыла» — `НОД(10, −3)`, а НЕ `НОД(1, ∞)`, и это не придирка к
     красоте. Граница входа напечатанной программы отвергает значение вне
     объявленного типа ДО вычисления, а `число` конечно: на бесконечности с
     машины приходит `FLANG_TYPE`, и сторож меры до дела не доходит вовсе. Взяв
     такой вход, тест проверял бы границу входа, думая, что проверяет сторожа.
     `остаток от` при отрицательном делителе несёт знак делимого, поэтому мера
     `б` идёт −3 → 1 и НЕ УБЫВАЕТ, оставаясь конечной. Бесконечности и NaN
     остались в сетке выше — там они сверяются с интерпретатором, и обе стороны
     согласно отвечают отказом границы. */
  const [дробная, ниже, неУбыла] = ask(built, [
    { fn: "НОД", args: [encode(1071.5), encode(462)] },
    { fn: "НОД", args: [encode(-10), encode(3)] },
    { fn: "НОД", args: [encode(10), encode(-3)] },
  ])
  for (const [ответ, условие] of [[дробная, /перестала быть целой/u], [ниже, /ушла ниже нуля/u],
    [неУбыла, /не убыла/u]]) {
    assert.equal(ответ.ok, false, `на входе без спуска собранный C обязан отказать: ${условие}`)
    assert.equal(ответ.code, "FLANG_MEASURE", `с машины пришёл ${ответ.code}, а не шестой вид отказа`)
    assert.match(ответ.message, условие, `с машины пришёл не тот текст: ${ответ.message}`)
  }
  t.diagnostic(`сверенных входов: ${points}, условий с машины: 3`)
})

/* ═════════ 10в. сторож частичной формы: 278 мест корпуса ═══════════════════ */

/**
 * Вход, на котором каждая частичная форма отказывает, — по одному на форму.
 *
 * ── Почему список, а не сетка руками ───────────────────────────────────────
 *
 * Частичная форма — второй вид сторожа в рантайме и самый многочисленный:
 * 278 мест в 67 файлах корпуса против 100 мест сторожа меры (считано обходом
 * дерева по `ЧАСТИЧНЫЕ`; больше всех у `элемент` — 114, дальше `хвост` 53,
 * `разделить` 35, `голова` 34, `подстрока` 29). Сверка с интерпретатором его
 * уже покрывала — но покрывала СЕТКОЙ, написанной руками внутри общего теста
 * строковых форм: убери из неё `[[]]` у «Головы», и клетка опустеет молча.
 *
 * Здесь источник — закрытый список `ЧАСТИЧНЫЕ` (`src/failures.mjs`), который
 * сам сверяется с `builtins.mjs` прогоном. Форма, появившаяся в нём девятой,
 * покрасит этот тест у всех восьми целей и назовёт себя, вместо того чтобы
 * тихо остаться у цели без сторожа.
 *
 * Имена функций — из `stringProgram` выше: там уже есть по обёртке на форму.
 */
const ЧАСТИЧНЫЕ_ВХОДЫ = new Map([
  ["голова", ["Голова", [[]]]],
  ["хвост", ["Хвост", [[]]]],
  ["элемент", ["Элемент", [0, [1, 2]]]],
  ["символ", ["Символ", [3, "аб"]]],
  ["подстрока", ["Подстрока", ["абв", 0, 2]]],
  ["разделить", ["Разделить", ["а,б", ""]]],
  ["к числу", ["К числу", ["не число"]]],
  ["код символа", ["Код символа", [""]]],
])

test("сторож частичной формы: все восемь форм отказывают у C кодом и текстом эталона", async (t) => {
  assert.deepEqual([...ЧАСТИЧНЫЕ_ВХОДЫ.keys()].sort(), [...ЧАСТИЧНЫЕ.keys()].sort(),
    "список частичных форм закрыт (src/failures.mjs) — вход обязан быть у каждой")

  const built = await build(stringProgram)
  const ответы = ask(built, [...ЧАСТИЧНЫЕ_ВХОДЫ.values()].map(([fn, args]) => ({ fn, args: args.map(encode) })));
  [...ЧАСТИЧНЫЕ_ВХОДЫ].forEach(([форма, [fn, args]], index) => {
    /* Эталон обязан отказать — иначе вход выбран неверно и клетка пуста при
       зелёном тесте. */
    const эталон = outcome(() => interpret(stringProgram, fn, args))
    assert.equal(эталон.ok, false, `«${форма}»: у эталона отказа нет — вход выбран неверно`)
    /* И отказ обязан ПРИЙТИ С МАШИНЫ, а не только совпасть. */
    const ответ = ответы[index]
    assert.equal(ответ.ok, false, `«${форма}»: C не отказал там, где отказал эталон`)
    assert.equal(ответ.code, "FLANG_BUILTIN_ARGS", `«${форма}»: с машины пришёл ${ответ.code}`)
    assert.equal(ответ.code, эталон.code, `«${форма}»: код разошёлся с эталоном`)
    assert.equal(ответ.message, эталон.message, `«${форма}»: текст с машины разошёлся с эталоном`)
  })
  t.diagnostic(`частичных форм с машины: ${ЧАСТИЧНЫЕ_ВХОДЫ.size}`)
})

/* ══════════════════════════ 11. форма результата ═══════════════════════════ */

test("детерминированность: две печати дают побайтово одно и то же", async () => {
  const programs = [violatingProgram, listProgram, treeProgram, mutualProgram, countdownProgram, stringProgram, parse(flangSource)]
  for (const program of programs) {
    const first = emitC(program)
    const second = emitC(program)
    assert.deepEqual(first, second)
    /* И ещё раз после кругосветки через JSON: вывод не зависит от того, откуда
       приехал AST. */
    const third = emitC(JSON.parse(JSON.stringify(program)))
    assert.deepEqual(first, third)
  }
})

test("напечатанный C ни от чего не зависит и объясняет себя", async () => {
  const built = await build(treeProgram)
  const all = built.emitted.files.map((file) => file.content).join("\n")
  /* POSIX-заголовки вычёркиваются вместе со своим `#ifdef`, а не разрешаются
     наравне с остальными, и разница здесь содержательная.
     `<pthread.h>` и `<sys/resource.h>` появились ради объявленного предела
     глубины: чтобы 10 000 кадров были не обещанием, а фактом, рантайм поднимает
     стек через `setrlimit` и уходит в поток со своим размером стека. Это POSIX,
     и переносимость держится ровно тем, что путь ОПЦИОНАЛЕН — блок стоит под
     `#ifdef FL_POSIX_STACK`, и без макроса печатается тот же C99, что и раньше.
     Разреши их списком — и завтра непортируемый заголовок приехал бы БЕЗ
     охраны, а тест смолчал бы. Поэтому проверяется не «какие заголовки», а
     «всё, что вне стандарта, живёт под охраной». */
  const безPosix = all.replace(/#ifdef FL_POSIX_STACK[\s\S]*?#endif/gu, "")
  assert.doesNotMatch(безPosix, /#include\s*<(?!stdarg|stdbool|stddef|stdio|stdlib|string|math|errno)/u,
    "кроме стандартной библиотеки C зависимостей быть не может")
  assert.match(all, /#ifdef FL_POSIX_STACK/u, "путь POSIX обязан быть под макросом, а не разрешён списком")
  assert.doesNotMatch(all, /\bglib\b|\butf8proc\b|\biconv\b/u)
  assert.doesNotMatch(all, /\btime\(|\brand\(|\bgetenv\(/u, "ни времени, ни случайности, ни окружения")
  assert.match(built.source, /^\/\*\n \* Сгенерировано flang/u)
  assert.match(built.source, /Не редактировать руками/u)
  /* Имена FTS сохраняются рядом с каждым типом и каждой функцией. */
  assert.match(built.header, /Функция flang «Сумма дерева»/u)
  assert.match(built.header, /Сумма типов FTS «Дерево»/u)
})

/**
 * Оболочка `flang repl` — единственный файл печати, которому нужен мир: она
 * ищет `cc` и каталоги установки, то есть спрашивает окружение и POSIX. Ровно
 * поэтому она, во-первых, отдельный файл (обещание выше остаётся верным для
 * всего остального, и взявший напечатанный C к себе в проект просто не берёт
 * этот файл), а во-вторых — печатается по просьбе: осмысленна она у одной
 * программы из всех, у самого компилятора flang.
 */
test("оболочка печатается только по просьбе, и её нужды названы поимённо", async () => {
  const без = emitC(treeProgram)
  assert.ok(!без.files.some((file) => file.path === "flang_repl.c"), "оболочка приехала без просьбы")
  /* Сам `#ifdef FL_WITH_REPL` в прогонщике есть всегда — нет только просьбы,
     то есть `#define`, который его включает. */
  assert.doesNotMatch(
    без.files.find((file) => file.path === "flang_cli.c").content,
    /#define FL_WITH_REPL/u,
    "прогонщик без просьбы не должен звать оболочку",
  )
  assert.doesNotMatch(без.files.find((file) => file.path === "Makefile").content, /flang_repl/u)

  const built = await build(treeProgram, { repl: true })
  const оболочка = built.emitted.files.find((file) => file.path === "flang_repl.c")
  assert.ok(оболочка !== undefined, "по просьбе оболочка обязана печататься")
  /* Список нужд оболочки записан здесь поимённо: POSIX ей нужен ради временного
     каталога, поиска бинарника, isatty и Ctrl-C, а окружение — ради FLANG_CC,
     FLANG_LIB_DIR и FLANG_INCLUDE_DIR. Вырасти незаметно этот список не может. */
  assert.doesNotMatch(
    оболочка.content,
    /#include\s*<(?!stdarg|stdbool|stddef|stdio|stdlib|string|math|errno|signal|unistd)/u,
    "оболочке хватает стандартной библиотеки C плюс signal.h и unistd.h",
  )
  assert.doesNotMatch(оболочка.content, /\btime\(|\brand\(/u, "ни времени, ни случайности не нужно и оболочке")
  /* И то, ради чего она вообще отдельно: прогонщик остаётся чистым C99. */
  const прогонщик = built.emitted.files.find((file) => file.path === "flang_cli.c")
  assert.doesNotMatch(прогонщик.content, /#include\s*<(signal|unistd)\.h>/u)
  assert.match(прогонщик.content, /#define FL_WITH_REPL 1/u, "просьба доезжает до прогонщика")
  assert.match(built.emitted.files.find((file) => file.path === "Makefile").content, /flang_repl\.o/u)

  /*
   * И главное: собранная так ЧУЖАЯ программа не выдаёт себя за flang. Файл один
   * на все программы, справка в нём написана про язык, и `--help` у программы
   * «Дерево» рассказал бы про flang и назвал бы его версию — то есть соврал бы
   * о себе там, где вопрос как раз о ней. Поэтому первым делом спрашивается
   * «кто я», и ответ здесь отрицательный.
   */
  for (const команда of ["--help", "--version", "check", "repl"]) {
    const итог = spawnSync(built.cli, [команда], { input: "", encoding: "utf8" })
    assert.equal(итог.status, 2, `«${команда}» у чужой программы обязан отказать`)
    assert.equal(итог.stdout, "", `«${команда}» у чужой программы что-то напечатал: ${итог.stdout}`)
    assert.match(итог.stderr, /человеческие команды есть только у компилятора flang/u)
  }
  /* А прогонщик у неё работает как прежде: контракт трубы не тронут. */
  const ответ = spawnSync(built.cli, [], { input: '{"fn":"Сумма дерева","args":[{"v":"Лист","f":[["значение",{"n":"7"}]]}]}\n', encoding: "utf8" })
  assert.equal(ответ.status, 0)
  assert.deepEqual(JSON.parse(ответ.stdout), { ok: true, value: { n: "7" } })
})

/*
 * Двунаправленные управляющие символы в литерале.
 *
 * Таблица блоков лексера (flang/self/lexer.flang) перечисляет весь блок
 * U+2000…U+207F подряд, и одиннадцать из них — двунаправленные управляющие.
 * Напечатанные сырыми, они ловятся -Wbidi-chars, и под -Werror напечатанный C
 * переставал собираться вовсе. Экранирование восьмеричными байтами обязано
 * убрать предупреждение, НЕ меняя значения: те же кодовые точки, та же длина.
 *
 * Долгое время эта проверка была единственной на весь проект — и потому три
 * цели, добавленные позже (java, csharp, elixir), правило не унаследовали.
 * Общая проверка на все цели сразу теперь в flang/test/emit-bidi.test.mjs, она
 * перебирает реестр целей; здесь остаётся то, чего та проверить не может, —
 * настоящий gcc с -Werror.
 *
 * Источник записан через `\uXXXX`, поэтому сырых двунаправленных нет и в самом
 * этом файле — иначе тест воспроизводил бы ровно ту беду, от которой стережёт.
 */
const bidiSource = [
  "модуль «Двунаправленные»",
  "",
  "тотальная функция «Метка»",
  "  возвращает строка",
  '  "\\u202aле\\u202cво"',
  "",
  "тотальная функция «Длина метки»",
  "  возвращает число",
  "  длина («Метка»)",
].join("\n")

const BIDI_CONTROLS = [0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]

test("двунаправленные управляющие экранируются: -Wbidi-chars молчит, значение то же", async () => {
  const program = parse(bidiSource)
  /* build() собирает с -Werror, и до починки падал уже здесь. */
  const built = await build(program)

  const all = built.emitted.files.map((file) => file.content).join("\n")
  const raw = [...all].filter((character) => BIDI_CONTROLS.includes(character.codePointAt(0)))
  assert.equal(raw.length, 0, "в напечатанном C не может быть сырых двунаправленных управляющих")

  /* Экранирование восьмеричное и побайтное: в узкой строке C нет `\u`. */
  assert.match(built.source, /\\342\\200\\252/u, "U+202A обязан приехать байтами 342 200 252")

  /* Главное: значение не изменилось — те же кодовые точки, та же длина. */
  const points =
    compare(program, built, "Метка", [[]]) + compare(program, built, "Длина метки", [[]])
  assert.equal(points, 2)
})

test("сборка и gcc, и clang с обязательными флагами на всех путях печати", async (t) => {
  /* По одной программе на каждый способ печати: суммы типов и конструкторы,
     батут, цикл хвостового самовызова, строковые формы, свёртка с записями.
     Собрать «что-нибудь одно» обоими компиляторами значило бы проверить
     заголовок, а не кодогенерацию. */
  const programs = [
    ["дерево-сумма", treeProgram],
    ["батут", mutualProgram],
    ["хвостовой цикл", countdownProgram],
    ["строковые формы", stringProgram],
    ["исходник через парсер", parse(flangSource)],
  ]
  const reports = []
  for (const cc of ["gcc", "clang"]) {
    for (const [what, program] of programs) {
      const built = await build(program, { cc, extraFlags: ["-O2"] })
      const [answer] = ask(built, [{ fn: program.functions[0].name, args: program.functions[0].params.map(() => null) }])
      assert.ok(typeof answer.ok === "boolean", `${cc} / ${what}: собранная программа обязана отвечать`)
    }
    const version = execFileSync(cc, ["--version"], { encoding: "utf8" }).split("\n")[0]
    reports.push(`${version}: ${CFLAGS.join(" ")} -O2, ${programs.length} программ — без предупреждений`)
  }
  t.diagnostic(reports.join("; "))
})

test("напечатанный Makefile собирает библиотеку и прогонщик", async (t) => {
  const built = await build(treeProgram)
  const make = spawnSync("make", ["-B"], { cwd: built.directory, encoding: "utf8" })
  if (make.error !== undefined && make.error.code === "ENOENT") {
    t.diagnostic("make в системе нет — проверка пропущена")
    return
  }
  assert.equal(make.status, 0, `make не собрал напечатанное:\n${make.stdout}\n${make.stderr}`)
  assert.match(make.stdout, /ar rcs libderevya\.a/u, "библиотека — часть выдачи, а не только прогонщик")
})

test("проверка на утечки: valgrind не находит ни потерянного байта", async (t) => {
  const probe = spawnSync("valgrind", ["--version"], { encoding: "utf8" })
  if (probe.status !== 0) {
    t.diagnostic("valgrind в системе нет — проверка пропущена")
    return
  }
  const built = await build(treeProgram)
  const лист = (n) => variant("Лист", { "значение": n })
  const узел = (l, r) => variant("Узел", { "левое": l, "правое": r })
  const глубокое = (depth) => (depth === 0 ? лист(1) : узел(глубокое(depth - 1), лист(depth)))
  const requests = [
    { fn: "Сумма дерева", args: [encode(глубокое(200))] },
    { fn: "Удвоить дерево", args: [encode(глубокое(200))] },
    { fn: "Сумма дерева", args: [encode(42)] },
    { fn: "Удвоить дерево", args: [encode(variant("Лист", {}))] },
    { fn: "Нет такой", args: [] },
  ]
  const run = spawnSync(
    "valgrind",
    ["--leak-check=full", "--show-leak-kinds=all", "--errors-for-leak-kinds=all", "--error-exitcode=9", built.cli],
    { input: `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`, encoding: "utf8" },
  )
  const report = (run.stderr ?? "").split("\n").filter((line) => /(ERROR SUMMARY|in use at exit|total heap usage)/u.test(line))
  assert.equal(run.status, 0, `valgrind нашёл проблему:\n${run.stderr}`)
  assert.match(run.stderr, /All heap blocks were freed -- no leaks are possible|in use at exit: 0 bytes/u)
  t.diagnostic(report.map((line) => line.replace(/^==\d+==\s*/u, "")).join(" | "))
})

/* ══════════════════════════ 12. ошибки печати ═══════════════════════════ */

test("статические ошибки ловятся при печати, а не в собранной программе", () => {
  const wrongArity = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "builtin", name: "длина", args: [] } }],
  }
  assert.throws(() => emitC(wrongArity), (error) => {
    assert.equal(errorCode(error), "FLANG_BUILTIN_ARGS")
    assert.equal(error.message, "«длина» ожидает 1 аргумент, получено 0")
    return true
  })

  const unknownName = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "var", name: "неизвестное" } }],
  }
  assert.throws(() => emitC(unknownName), (error) => {
    assert.equal(errorCode(error), "FLANG_UNKNOWN_NAME")
    assert.equal(error.message, "имя «неизвестное» не связано")
    return true
  })

  const unknownCall = {
    flang: 1,
    functions: [{ name: "Ф", params: [], body: { kind: "call", name: "Нет такой", args: [] } }],
  }
  assert.throws(() => emitC(unknownCall), (error) => errorCode(error) === "FLANG_UNKNOWN_NAME")

  /* «Сумма» и «сумма» — разные имена модели, но один идентификатор C. */
  const collision = {
    flang: 1,
    functions: [
      { name: "Сумма", params: [], body: { kind: "literal", value: 1 } },
      { name: "сумма", params: [], body: { kind: "literal", value: 2 } },
    ],
  }
  assert.throws(() => emitC(collision), /идентификатор/u)
})

test("затенение локальных имён и совпадение с именем функции", async () => {
  const program = {
    flang: 1,
    module: "Тени",
    functions: [
      {
        name: "значение",
        params: [{ name: "значение" }],
        body: {
          kind: "let",
          name: "х",
          value: { kind: "literal", value: 1 },
          in: {
            kind: "let",
            name: "х",
            value: { kind: "binary", op: "add", left: { kind: "var", name: "х" }, right: { kind: "literal", value: 10 } },
            in: {
              kind: "binary",
              op: "add",
              left: { kind: "var", name: "х" },
              right: { kind: "var", name: "значение" },
            },
          },
        },
      },
    ],
  }
  const built = await build(program)
  compare(program, built, "значение", [[0], [5], ["строка"]])
  const [answer] = ask(built, [{ fn: "значение", args: [encode(5)] }])
  assert.equal(decode(answer.value), 16)
})

test("самовызов в цикл без единого значения в хвосте гасит result и собирается", async () => {
  /* Третье место с одним и тем же недосмотром. Функция, у которой ВСЕ хвостовые
     позиции — самовызов, разворачивается в вечный цикл и ни разу не пишет в
     *result; под -Wextra с -Werror это несобираемый C.

     Сначала чинили шаг батута (взаимная рекурсия), потом выяснилось, что для
     прямой рекурсии дефект остался — нашла его глава курса, где такая функция
     приведена примером незавершающейся программы. build() и печатает, и
     собирает, поэтому падение сборки здесь и есть проверка. */
  const built = await build({
    flang: 1,
    module: "Вечность",
    functions: [
      {
        name: "Вечность",
        total: false,
        params: [{ name: "счёт", type: { kind: "number" } }],
        returns: { kind: "number" },
        body: {
          kind: "call",
          name: "Вечность",
          args: [
            { kind: "binary", op: "add", left: { kind: "var", name: "счёт" }, right: { kind: "literal", value: 1 } },
          ],
        },
        examples: [],
      },
    ],
  })
  assert.match(built.source, /\(void\)result;/u, "тело вечного цикла обязано гасить result")
})
