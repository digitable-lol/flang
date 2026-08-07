#!/usr/bin/env node
/**
 * Сборка релизного C: компилятор flang, напечатанный в самодостаточный
 * исходник на C99.
 *
 * Зачем это существует. Компилятор языка написан на самом языке
 * (`flang/self/`), и печатается он в C. Значит его можно положить в релиз уже
 * напечатанным — и тогда пользователю не нужен ни Node, ни сам flang, чтобы
 * поставить flang: достаточно `cc` и `make`. Ровно так поступают
 * самоприменяющиеся языки; Go долго возил сгенерированный C, Nim возит до сих
 * пор.
 *
 * Это снимает проблему начальной загрузки для всех, кроме тех, кто развивает
 * сам язык: чтобы получить первый бинарник из исходников на flang, Node нужен,
 * а чтобы собрать из релиза — нет.
 *
 * Что кладётся в релиз:
 *
 *   flang_runtime.h  flang_runtime.c   рантайм: значения, арена, встроенные формы
 *   kompilyator_flang.h  .c            сам компилятор, шесть слоёв
 *   flang_cli.c                        прогонщик: JSON на входе и выходе
 *   flang_repl.c                       человеческий вход: --help, check, repl
 *   flang.1                            страница руководства (man flang)
 *   Makefile                           cc -std=c99 -Werror -pedantic
 *
 * Проверка на месте, а не на веру: напечатанное собирается прямо здесь, в
 * окружении без Node в PATH, и собранный бинарник вызывается. Если релиз не
 * собирается — скрипт падает, и битый релиз не уезжает. Человеческие команды
 * проверяются тем же способом и по той же причине: `flang --help`, который
 * молчит и отвечает нулём, ничем не отличается от отсутствующего, и узнать об
 * этом надо здесь, а не от человека после `brew install`.
 */
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const корень = resolve(dirname(fileURLToPath(import.meta.url)), "..")
/* Версия — из package.json, а не строкой рядом: релиз, называющий себя иначе,
   чем пакет, из которого собран, никому не объяснишь. */
const пакет = JSON.parse(readFileSync(join(корень, "package.json"), "utf8"))
const источник = join(корень, "flang/self/bootstrap/compiler.flang")
const каталог = process.argv[2] ?? join(корень, "output/release-c")

const { loadProgram } = await import(join(корень, "flang/bin/flang.mjs"))
const { emitC } = await import(join(корень, "flang/src/emit/c.mjs"))

console.log(`компилятор: ${источник}`)
const программа = await loadProgram(источник)
console.log(`связано функций: ${программа.functions.length}, типов: ${программа.types.length}`)

/*
 * Пределы те же, с которыми эталон запускает компилятор на самом себе, и это
 * не запас «на всякий случай». Умолчания бэкенда (10⁶ шагов, 10⁴ глубины)
 * рассчитаны на обычную программу; компилятор разбирает 119 тысяч токенов и
 * упирается в них на «Связать вызовы» — то есть релиз, собранный с
 * умолчаниями, отвечает FLANG_RECURSION_LIMIT на любой настоящий вход и
 * проходит только проверку на трёхстрочном модуле. Ровно так и уехал v0.4.1;
 * нашлось это при слиянии, когда лимит шагов встретился с неподвижной точкой.
 */
/* `repl: true` — оболочка `flang repl`. Просят её здесь и только здесь: у любой
   другой напечатанной программы нет точек входа, которые оболочка зовёт, и
   возить ей сто килобайт кода, который она не может исполнить, незачем. */
const напечатано = emitC(программа, { cli: true, repl: true, maxSteps: 40_000_000, maxDepth: 20_000 })

rmSync(каталог, { recursive: true, force: true })
mkdirSync(каталог, { recursive: true })
let всего = 0
for (const файл of напечатано.files) {
  const путь = join(каталог, файл.path)
  mkdirSync(dirname(путь), { recursive: true })
  writeFileSync(путь, файл.content, "utf8")
  всего += Buffer.byteLength(файл.content, "utf8")
  console.log(`  ${файл.path}  ${(Buffer.byteLength(файл.content, "utf8") / 1024).toFixed(0)} КБ`)
}
/*
 * Страница руководства кладётся рядом с исходниками, а не в подкаталог: формула
 * Homebrew ставит её строкой `man1.install "flang.1"` из корня распакованного
 * архива, и лишний уровень пришлось бы держать в голове обеим упаковкам.
 * Печатью она не порождается — это текст про фактический интерфейс, а не про
 * программу, — поэтому копируется из репозитория как есть.
 */
const страница = join(корень, "packaging/flang.1")
writeFileSync(join(каталог, "flang.1"), readFileSync(страница, "utf8"), "utf8")
console.log(`  flang.1  ${(readFileSync(страница).length / 1024).toFixed(0)} КБ (из packaging/)`)
console.log(`итого ${(всего / 1024 / 1024).toFixed(2)} МБ в ${каталог}`)

/* Сборка в окружении без Node: если релиз требует Node, обещание «нужен только
   cc» ложно, и узнать об этом надо здесь, а не от пользователя. */
const компилятор = ["cc", "gcc", "clang"].find((имя) => {
  try {
    execFileSync("which", [имя], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
})

if (компилятор === undefined) {
  console.log("компилятора C в системе нет — сборка релиза не проверена")
  process.exit(0)
}

console.log(`\nпроверка сборки (${компилятор}, PATH без Node):`)
execFileSync("make", ["-C", каталог], {
  stdio: "inherit",
  env: { PATH: "/usr/bin:/bin:/usr/local/bin", HOME: process.env.HOME ?? "/tmp" },
})

const собрано = readdirSync(каталог)
if (!собрано.includes("flang_cli")) {
  console.error("сборка прошла, но flang_cli не появился")
  process.exit(1)
}

/* Прогон: бинарник обязан не просто собраться, а ответить. */
const запрос = JSON.stringify({
  fn: "Число связанных функций",
  args: [
    { l: [{ r: [["путь", { s: "проба.flang" }], ["текст", { s: 'модуль «Проба»\n\nтотальная функция «Два»\n  возвращает число\n  2\n' }]] }] },
    { s: "проба.flang" },
  ],
})
const ответ = execFileSync(join(каталог, "flang_cli"), [], {
  input: `${запрос}\n`,
  env: { PATH: "/usr/bin:/bin" },
}).toString()
const итог = JSON.parse(ответ)
if (итог.ok !== true) {
  console.error(`собранный компилятор не отвечает: ${ответ}`)
  process.exit(1)
}
console.log(`\nсобранный компилятор ответил: ${ответ.trim()}`)

/* Проба выше слишком дешёвая: на трёхстрочном модуле не видно ни пределов, ни
   памяти. Настоящая проверка — дать бинарнику разобрать файл компилятора,
   то есть тот самый вход, на котором умолчания и обрывались. */
const тяжёлый = join(корень, "flang/self/parser.flang")
const тяжкийЗапрос = JSON.stringify({
  fn: "Число связанных функций",
  args: [
    { l: [{ r: [["путь", { s: "parser.flang" }], ["текст", { s: readFileSync(тяжёлый, "utf8") }]] }] },
    { s: "parser.flang" },
  ],
})
const тяжкийОтвет = execFileSync(join(каталог, "flang_cli"), [], {
  input: `${тяжкийЗапрос}\n`,
  env: { PATH: "/usr/bin:/bin" },
  maxBuffer: 64 * 1024 * 1024,
}).toString()
const тяжкийИтог = JSON.parse(тяжкийОтвет)
if (тяжкийИтог.ok !== true) {
  console.error(`релиз не справился с настоящим входом (${тяжёлый}): ${тяжкийОтвет.slice(0, 200)}`)
  process.exit(1)
}
console.log(`разобрал self/parser.flang: функций ${тяжкийИтог.value.n}`)

/*
 * Человеческий вход: то, ради чего язык ставят из brew. Проверяется запуском, а
 * не наличием строк в исходнике, — потому что ровно этим бинарник и подвёл: он
 * ПРИНИМАЛ `--help` и `check` (аргументы никого не смущали), молчал в ответ и
 * отвечал нулём. Тест, который смотрит на код возврата, такое пропускает; тест,
 * который требует непустого вывода, — нет.
 */
const человек = (аргументы, вход = "") =>
  spawnSync(join(каталог, "flang_cli"), аргументы, {
    input: вход,
    encoding: "utf8",
    env: { PATH: "/usr/bin:/bin", HOME: process.env.HOME ?? "/tmp" },
    maxBuffer: 16 * 1024 * 1024,
  })

const справка = человек(["--help"])
if (справка.status !== 0 || !справка.stdout.includes("flang check")) {
  console.error(`«flang --help» не рассказал о себе: код ${справка.status}, вывод ${JSON.stringify(справка.stdout)}`)
  process.exit(1)
}
const версия = человек(["--version"])
if (версия.status !== 0 || версия.stdout.trim() !== `flang ${пакет.version}`) {
  console.error(`«flang --version» назвал не ту версию: ${JSON.stringify(версия.stdout)}, ждали flang ${пакет.version}`)
  process.exit(1)
}

/* Проверка настоящего файла: годный обязан дать 0, сломанный — 1 и замечание с
   кодом. Оба случая, потому что «всегда 0» и «всегда 1» одинаково бесполезны. */
const проба = join(каталог, "проба.flang")
writeFileSync(проба, "модуль «Проба»\n\nтотальная функция «Два»\n  возвращает число\n  2\n", "utf8")
const годный = человек(["check", проба])
if (годный.status !== 0 || !годный.stdout.includes("проверено")) {
  console.error(`«flang check» не проверил годный файл: код ${годный.status}, ${годный.stdout}${годный.stderr}`)
  process.exit(1)
}
writeFileSync(проба, "модуль «Проба»\n\nтотальная функция «Два»\n  возвращает число\n  \"два\"\n", "utf8")
const сломанный = человек(["check", проба])
if (сломанный.status !== 1 || !сломанный.stderr.includes("FLANG_TYPE")) {
  console.error(`«flang check» не заметил ошибку типов: код ${сломанный.status}, ${сломанный.stderr}`)
  process.exit(1)
}
rmSync(проба)
console.log(`человеческий вход: ${версия.stdout.trim()}, справка ${справка.stdout.split("\n").length} строк, check отвечает 0 и 1`)

/* Страница руководства обязана не просто лежать, а разбираться troff: битую
   заметит человек, набравший `man flang`, и заметит молча — man покажет мусор. */
const troff = ["groff", "nroff"].find((имя) => {
  try {
    execFileSync("which", [имя], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
})
if (troff === undefined) {
  console.log("troff в системе нет — страница руководства не проверена")
} else {
  /* Жирное и подчёркнутое groff размечает управляющими последовательностями
     терминала: их снимает `man`, а нам они мешают искать слова. */
  const набрано = execFileSync(troff, ["-K", "utf8", "-man", "-Tutf8", join(каталог, "flang.1")], {
    encoding: "utf8",
    env: { PATH: "/usr/bin:/bin", HOME: process.env.HOME ?? "/tmp" },
  }).replace(/\[[0-9;]*m/gu, "")
  if (!набрано.includes("FLANG(1)") || !набрано.includes("flang check")) {
    console.error("страница руководства набралась, но это не страница про flang check")
    process.exit(1)
  }
  console.log(`страница руководства набирается ${troff}: ${набрано.split("\n").length} строк`)
}

console.log(existsSync(join(каталог, "flang_cli")) ? "релиз готов" : "релиз не готов")
