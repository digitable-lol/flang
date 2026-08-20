/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * ПУТЬ УСТАНОВКИ ИЗ NPM — проверки, которой до 20 августа 2026 не было вовсе.
 *
 * За одни сутки этот путь ломался ЧЕТЫРЕ раза, и каждый раз потому, что его
 * никто не проходил целиком: `npm pack` собирался, тесты зеленели, а
 * поставленный пакет не отвечал. Здесь он проходится целиком и на настоящем
 * файле: тарбол собирается, ставится в ПУСТОЙ каталог, и `flang` зовётся так,
 * как его зовёт человек, — через `node_modules/.bin`.
 *
 * ── ГЛАВНОЕ УТВЕРЖДЕНИЕ ─────────────────────────────────────────────────────
 * Из npm приезжает ТОТ ЖЕ компилятор, что из brew, а не вторая реализация.
 * Проверяется это не осмотром пакета, а прогоном ОБЕИХ установок по одному
 * корпусу с побайтовой сверкой кода возврата, вывода и потока ошибок. Корпус и
 * сверка написаны на самом flang (`packaging/sverka-ustanovok.flang`); здесь
 * только запуск и разбор ответа.
 *
 * Замер, ради которого всё это заводилось (ветка `vypusk/npm-dvoichnyy`,
 * 59 вызовов корпуса):
 *
 *   до правки  54 расхождения — из npm приезжала реализация на JavaScript
 *   после      7 расхождений  — и все семь суть то, что npm даёт СВЕРХ
 *                               двоичного: печать в js, go, rust, python,
 *                               java, csharp, elixir
 *
 * Ноль здесь недостижим и не нужен: пакет обязан уметь БОЛЬШЕ бинарника, иначе
 * человек, ставящий через npm, потеряет семь целей печати и языковой сервер.
 * Проверяется поэтому не «расхождений ноль», а «расхождения ровно там, где
 * объявлено»: список сверяется поимённо.
 *
 * ── ЧТО СЛОМАЕТСЯ, ЕСЛИ ЭТО ПОКРАСНЕЕТ ──────────────────────────────────────
 * Меньше семи — двоичный догнал одну из целей, и `ЦЕЛИ_ЧЕРЕЗ_NODE` в
 * `packaging/flang-zapusk.mjs` пора укоротить. Больше семи или другое имя в
 * списке — две установки разошлись, и это ровно та беда, ради которой пакет
 * переделывали.
 *
 * Запуск: node --test flang/test/ustanovka-npm.test.mjs
 */
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const корень = fileURLToPath(new URL("../..", import.meta.url))
const ПАКЕТ = JSON.parse(readFileSync(join(корень, "package.json"), "utf8"))
const СВЕРКА = join(корень, "packaging", "sverka-ustanovok.flang")

/* Флаги brew, знак в знак (`packaging/homebrew/flang.rb`). Эталон обязан
   собираться ТЕМ ЖЕ способом, каким его собирает Homebrew, иначе сверялись бы
   две сборки npm, а не два пути установки. */
const ФЛАГИ_BREW = "-std=c99 -Wall -Wextra -Werror -pedantic -O2"

/* Семь целей печати, которых у двоичного нет. Список тот же, что в
   `packaging/flang-zapusk.mjs`, и это НЕ дубль ради удобства: проверка обязана
   знать ожидаемое независимо от проверяемого, иначе она сверяла бы список сам с
   собой. */
const ЦЕЛИ_ЧЕРЕЗ_NODE = ["js", "go", "rust", "python", "java", "csharp", "elixir"]

const естьВПути = (программа) => spawnSync(программа, ["--version"], { stdio: "ignore" }).error === undefined
const НЕТ_ТУЛЧЕЙНА = !естьВПути("cc") || !естьВПути("make")

const вовремя = (метка) => mkdtempSync(join(tmpdir(), `flang-${метка}-`))

/** Собрать тарбол пакета. Возвращает путь к нему и его размер. */
function упаковать(куда) {
  const вывод = execFileSync("npm", ["pack", "--pack-destination", куда, "--json"], {
    cwd: корень,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  const [сведения] = JSON.parse(вывод)
  return { путь: join(куда, сведения.filename), ...сведения }
}

/** Поставить тарбол в пустой каталог. `путь` — куда ставить. */
function поставить(тарбол, куда, окружение = process.env, довески = []) {
  mkdirSync(куда, { recursive: true })
  writeFileSync(join(куда, "package.json"), JSON.stringify({ name: "проба", private: true }, null, 2))
  const итог = spawnSync("npm", ["install", тарбол, "--no-audit", "--no-fund", ...довески], {
    cwd: куда,
    encoding: "utf8",
    env: окружение,
    maxBuffer: 64 * 1024 * 1024,
  })
  return { ...итог, вывод: `${итог.stdout ?? ""}${итог.stderr ?? ""}` }
}

/** Позвать `flang` так, как его зовёт человек: через node_modules/.bin. */
const позвать = (куда, доводы, окружение = {}) =>
  spawnSync(join(куда, "node_modules", ".bin", "flang"), доводы, {
    cwd: куда,
    encoding: "utf8",
    env: { ...process.env, ...окружение },
    maxBuffer: 64 * 1024 * 1024,
  })

/* Установка одна на все проверки: два `npm install` подряд стоили бы вдвое, а
   доказывают одно. Заводится лениво — если тулчейна нет, она не нужна вовсе. */
let поставленное = null
function установка() {
  if (поставленное !== null) return поставленное
  const где = вовремя("npm")
  const { путь, size, unpackedSize, entryCount } = упаковать(где)
  const куда = join(где, "pustoy")
  const итог = поставить(путь, куда)
  поставленное = { где, тарбол: путь, размер: size, распакованный: unpackedSize, файлов: entryCount, куда, итог }
  return поставленное
}

/** Эталон: тот же C, собранный и поставленный так, как это делает Homebrew. */
let эталонный = null
function эталон() {
  if (эталонный !== null) return эталонный
  const где = вовремя("brew")
  const стройка = join(где, "sborka")
  cpSync(join(корень, "bootstrap"), стройка, { recursive: true })
  execFileSync("make", ["-j4", "flang", `CFLAGS=${ФЛАГИ_BREW}`], { cwd: стройка, stdio: "ignore" })
  execFileSync("make", ["install", `PREFIX=${join(где, "prefix")}`, `CFLAGS=${ФЛАГИ_BREW}`], {
    cwd: стройка,
    stdio: "ignore",
  })
  эталонный = { где, флаг: join(где, "prefix", "bin", "flang") }
  return эталонный
}

test("ПАКЕТ СТАВИТСЯ В ПУСТОЙ КАТАЛОГ И ОТВЕЧАЕТ — на настоящем файле", { skip: НЕТ_ТУЛЧЕЙНА && "нет cc или make" }, () => {
  const { куда, итог, размер, файлов } = установка()
  assert.equal(итог.status, 0, `npm install вернул ${итог.status}:\n${итог.вывод}`)
  console.log(`тарбол: файлов ${файлов}, ${(размер / 1024 / 1024).toFixed(2)} МБ`)

  /* Двоичный обязан быть СОБРАН, а не обещан. Путь `dvoichnyy/flang` рядом с
     корнем пакета выбран не произвольно: из него бинарник находит исходники
     рантайма C сам (см. шапку packaging/postinstall.mjs). */
  const двоичный = join(куда, "node_modules", "@digitable-lol", "flang", "dvoichnyy", "flang")
  assert.ok(existsSync(двоичный), "двоичный компилятор не собран при установке")
  console.log(`двоичный: ${(statSync(двоичный).size / 1024 / 1024).toFixed(1)} МБ`)

  /* Версия — от бинарника, а не от реализации на Node: они печатают её
     по-разному, и по этой строке видно, кто ответил. */
  const версия = позвать(куда, ["--version"])
  assert.equal(версия.status, 0, версия.stderr)
  assert.equal(версия.stdout, `flang ${ПАКЕТ.version}\n`, "на --version ответил не двоичный")

  writeFileSync(
    join(куда, "primer.flang"),
    "модуль «Пример»\n\nтотальная функция «Удвоить»\n  принимает н: число\n  возвращает число\n  пример «два даёт четыре»\n    дано н равно 2\n    ожидается 4\n  н умножить на 2\n",
  )
  const проверка = позвать(куда, ["check", "primer.flang"])
  assert.equal(проверка.status, 0, `${проверка.stdout}${проверка.stderr}`)
  assert.match(проверка.stdout, /проверено/)
  const примеры = позвать(куда, ["test", "primer.flang"])
  assert.equal(примеры.status, 0, `${примеры.stdout}${примеры.stderr}`)
  assert.match(примеры.stdout, /примеров 1, прошло 1, не прошло 0/)

  /* Печать в C — та, ради которой бинарнику нужны исходники рантайма. Если бы
     он их не нашёл, отказ пришёл бы здесь, а не у человека после установки. */
  mkdirSync(join(куда, "out-c"), { recursive: true })
  const вC = позвать(куда, ["emit", "primer.flang", "--target", "c", "--out", "./out-c"])
  assert.equal(вC.status, 0, `${вC.stdout}${вC.stderr}`)
  assert.ok(readdirSync(join(куда, "out-c")).includes("flang_runtime.h"), "рантайм C не найден из пакета")

  /* И то, чего у двоичного нет: печать в семь целей обязана продолжать
     работать, иначе переход был бы ухудшением. */
  for (const цель of ЦЕЛИ_ЧЕРЕЗ_NODE) {
    const итог = позвать(куда, ["emit", "primer.flang", "--target", цель])
    assert.equal(итог.status, 0, `цель «${цель}» отказала: ${итог.stderr}`)
    assert.match(итог.stdout, new RegExp(`"target":"${цель}"`), `цель «${цель}» напечатала не то`)
  }
  assert.ok(existsSync(join(куда, "node_modules", ".bin", "flang-lsp")), "языковой сервер не поставлен")
})

test("БЕЗ КОМПИЛЯТОРА C установка не падает, а отказ называет причину и что делать", { skip: НЕТ_ТУЛЧЕЙНА && "нет cc или make" }, () => {
  /* PATH собирается заново: в нём есть node, npm и оболочка — без них npm не
     запустит ни одного скрипта, — и НЕТ ни cc, ни gcc, ни clang, ни make. Так
     воспроизводится машина, на которой пакет ставят в контейнер без
     build-essential; это самый частый случай, и до 20 августа 2026 он не
     проверялся ни разу. */
  const где = вовремя("bez-cc")
  const тощий = join(где, "path")
  mkdirSync(тощий, { recursive: true })
  const нужны = ["node", "npm", "sh", "bash", "env", "rm", "mkdir", "cp", "ln", "tar", "gzip"]
  for (const имя of нужны) {
    const найден = spawnSync("sh", ["-c", `command -v ${имя}`], { encoding: "utf8" }).stdout.trim()
    if (найден !== "") symlinkSync(найден, join(тощий, имя))
  }
  const окружение = { ...process.env, PATH: тощий, CC: "cc", MAKE: "make" }

  const { тарбол } = установка()
  const куда = join(где, "pustoy")
  /* `--foreground-scripts` — не украшение прогона, а единственный способ увидеть
     текст: npm с 7-й версии прячет вывод УДАВШИХСЯ скриптов установки. Отсюда
     следует главное здесь: на текст при установке полагаться нельзя, и настоящий
     отказ обязан прийти при первом вызове `flang` — это третья часть проверки. */
  const итог = поставить(тарбол, куда, окружение, ["--foreground-scripts"])

  /* Первое: установка ПРОШЛА. Упавший postinstall оставил бы человека без
     языкового сервера и без семи целей печати, которые Node даёт и без
     бинарника. */
  assert.equal(итог.status, 0, `установка без cc упала:\n${итог.вывод}`)
  assert.ok(
    !existsSync(join(куда, "node_modules", "@digitable-lol", "flang", "dvoichnyy", "flang")),
    "подделка мимо цели: бинарник всё-таки собрался, значит cc в PATH остался",
  )
  /* Второе: отказ назвал причину и что делать. «Что делать» проверяется
     поимённо — сообщение без команды установки читается как «оно сломалось». */
  assert.match(итог.вывод, /двоичный компилятор не собран/)
  assert.match(итог.вывод, /build-essential/)

  /* Третье, и ради него всё: команда отказывает ВНЯТНО, а не падает стеком и не
     подменяет компилятор молча реализацией на Node. Молчаливая подмена и есть
     та беда, ради которой пакет переделывали. */
  const ответ = spawnSync(join(куда, "node_modules", ".bin", "flang"), ["check", "нет.flang"], {
    cwd: куда,
    encoding: "utf8",
    env: окружение,
  })
  assert.equal(ответ.status, 3, `ожидался код 3 «сломался инструмент», пришло ${ответ.status}`)
  assert.doesNotMatch(ответ.stderr, /at .*\.mjs:\d+/, "вместо объяснения человек получил стек")
  assert.match(ответ.stderr, /двоичный компилятор не собран/)
  assert.match(ответ.stderr, /npm rebuild @digitable-lol\/flang/)

  rmSync(где, { recursive: true, force: true })
})

test("ДВЕ УСТАНОВКИ НЕ РАСХОДЯТСЯ: путь brew и путь npm на одном корпусе", { skip: НЕТ_ТУЛЧЕЙНА && "нет cc или make" }, () => {
  const { куда } = установка()
  const пакет = join(куда, "node_modules", "@digitable-lol", "flang")
  const { флаг } = эталон()

  /* Сверка идёт рядом с настройкой: хозяин ввода-вывода ищет файлы плана
     относительно самого плана, а не рабочего каталога. */
  const работа = вовремя("sverka")
  cpSync(СВЕРКА, join(работа, basename(СВЕРКА)))
  writeFileSync(
    join(работа, "sverka-nastroyka.txt"),
    [флаг, "", join(куда, "node_modules", ".bin", "flang"), "", пакет, работа].join("\n"),
  )
  /* Рантайм C назван обеим сторонам явно и одинаково. Иначе сверялась бы
     раскладка каталогов двух установок (у brew рантайма нет вовсе — формула
     кладёт только заголовки), а не поведение команд. */
  const итог = spawnSync(флаг, ["io", join(работа, basename(СВЕРКА)), "--max-orders", "4000"], {
    cwd: работа,
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C.UTF-8", FLANG_RUNTIME_DIR: join(пакет, "flang", "src", "emit", "c") },
    maxBuffer: 256 * 1024 * 1024,
  })
  assert.equal(итог.status, 0, `сверка не дошла до конца: ${итог.stderr}`)
  const ответ = JSON.parse(итог.stdout)
  const разошлись = ответ.log
    .filter((шаг) => шаг.поручение.variant === "Показать")
    .map((шаг) => шаг.поручение.fields.текст)
    .filter((строка) => строка.startsWith("РАСХОЖДЕНИЕ"))
  console.log(`сверка установок: вызовов 59, расхождений ${ответ.result}`)
  for (const строка of разошлись) console.log(`  ${строка}`)

  /* Расхождения обязаны быть РОВНО там, где объявлено: семь целей печати,
     которых у двоичного нет. Одно лишнее имя — две установки разъехались. */
  const цели = разошлись
    .map((строка) => /--target (\S+)/u.exec(строка)?.[1])
    .filter((цель) => цель !== undefined)
    .sort()
  assert.deepEqual(
    цели,
    [...ЦЕЛИ_ЧЕРЕЗ_NODE].sort(),
    "разошлись не те вызовы, что объявлены: две установки перестали быть одним компилятором",
  )
  assert.equal(ответ.result, ЦЕЛИ_ЧЕРЕЗ_NODE.length, `расхождений ${ответ.result}, а объявлено ${ЦЕЛИ_ЧЕРЕЗ_NODE.length}`)

  /* Прибирается всё разом и здесь, последней проверкой файла: обе установки
     нужны всем трём, а держать их до конца прогона — 40 МБ во временном
     каталоге на два часа. */
  for (const мусор of [работа, эталонный.где, поставленное.где]) rmSync(мусор, { recursive: true, force: true })
  эталонный = null
  поставленное = null
})
