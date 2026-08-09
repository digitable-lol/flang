/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Что этот прогон проверит по-настоящему, а что только сделает вид.
 *
 * Тест бэкенда доказывает кодогенерацию единственным способом: настоящий
 * компилятор принял порождённый код. Компилятора может не быть, и тогда тест
 * пропускается (tools/ftsc/test/toolchain-guard.mjs). Беда в том, что итог
 * прогона печатает только «skipped: 128» — число без имён. Оно читается как
 * «всё хорошо», и дважды за 7 августа 2026 это стоило ложного вывода:
 * выпуск 0.4.6 ушёл с дефектом кодогенерации Go, потому что локально Go не
 * было и «зелено» означало «Go никто не проверял».
 *
 * Поэтому перед прогоном печатается таблица: какая цель проверяется настоящим
 * компилятором, какая пропускается, по какой причине и сколько тестов этот
 * пропуск прячет. Пропуск виден в выводе прямо, а не выводится вычитанием.
 *
 *   node scripts/preflight.mjs             таблица и итог, код возврата 0
 *   node scripts/preflight.mjs --strict    отсутствие тулчейна — провал (код 1)
 *   node scripts/preflight.mjs --fast      не считать скрытые тесты
 *   node scripts/preflight.mjs --registry  сверить версию с реестром npm (сеть)
 *
 * Строгость включается сама, если задана FTS_REQUIRE_TOOLCHAINS: джоба, которая
 * тулчейн ставит, обязана падать сразу, а не через сорок минут прогона.
 */
import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { loadTargets, probeToolchain } from "../tools/ftsc/src/targets.mjs"
import { requiredToolchains, toolchainRequired } from "../tools/ftsc/test/toolchain-guard.mjs"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const argv = new Set(process.argv.slice(2))
const strict = argv.has("--strict") || requiredToolchains().length > 0
const fast = argv.has("--fast")
const withRegistry = argv.has("--registry")

const BOLD = "\u001B[1m"
const DIM = "\u001B[2m"
const RED = "\u001B[31m"
const GREEN = "\u001B[32m"
const YELLOW = "\u001B[33m"
const RESET = "\u001B[0m"
const colour = process.stdout.isTTY && !process.env.NO_COLOR
const paint = (code, text) => (colour ? `${code}${text}${RESET}` : text)

const problems = []

/* ── что вообще есть за цели ──────────────────────────────────────────────── */

/**
 * Файлы тестов, которые прячутся за тулчейном цели `id`.
 *
 * Список не записан константой: он вычитывается из самих тестов по вызовам
 * missingToolchain(t, "<id>", …). Константа разошлась бы с тестами при первом
 * же новом файле, а разошедшийся сторож — ровно та поломка, от которой этот
 * отчёт и заведён.
 */
function testFilesByTarget() {
  const directories = [join(root, "flang", "test"), ...toolTestDirectories()]
  const map = new Map()
  for (const directory of directories) {
    if (!existsSync(directory)) continue
    for (const name of readdirSync(directory)) {
      if (!name.endsWith(".test.mjs")) continue
      const file = join(directory, name)
      let source = ""
      try {
        source = readFileSync(file, "utf8")
      } catch (_) {
        continue
      }
      for (const match of source.matchAll(/missingToolchain\(\s*[A-Za-z_$][\w$]*\s*,\s*"([^"]+)"/gu)) {
        const id = match[1]
        if (!map.has(id)) map.set(id, [])
        if (!map.get(id).includes(file)) map.get(id).push(file)
      }
    }
  }
  return map
}

function toolTestDirectories() {
  const tools = join(root, "tools")
  if (!existsSync(tools)) return []
  return readdirSync(tools)
    .map((name) => join(tools, name, "test"))
    .filter((directory) => existsSync(directory))
}

/**
 * Сколько тестов прячет отсутствующий тулчейн — измерением, а не оценкой.
 *
 * Считать дёшево именно потому, что тулчейна нет: его тесты пропускаются
 * мгновенно. Для присутствующего тулчейна ничего не запускается — там нечего
 * прятать. Если бы число бралось из таблицы в коде, оно устарело бы к первому
 * новому тесту и снова обмануло бы читателя.
 */
function countHiddenTests(files) {
  const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...files], {
    cwd: root,
    encoding: "utf8",
    timeout: 300000,
    env: { ...process.env, FTS_REQUIRE_TOOLCHAINS: "" },
    maxBuffer: 64 * 1024 * 1024,
  })
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
  const names = []
  for (const line of output.split("\n")) {
    const match = /^\s*(?:not )?ok\s+\d+\s+-\s+(.*?)\s+#\s+SKIP\b/u.exec(line)
    if (match) names.push(match[1].trim())
  }
  return { count: names.length, names, measured: !result.error }
}

/* ── свежесть зависимостей ────────────────────────────────────────────────── */

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (_) {
    return null
  }
}

/**
 * Вендорная копия зависимостей — тоже сторож, и он тоже умеет молчать.
 *
 * 7 августа 2026 node_modules отставал от package.json на две версии, и два
 * измерения подряд («пакет ставит шесть команд») были сняты со старого дерева.
 * Отставание не видно ниоткуда: npm ничего не говорит, тесты зелены. Поэтому
 * расхождение печатается здесь, рядом с тулчейнами: обе проверки об одном — о
 * том, что прогон мерил не то, что думает.
 */
function checkDependencies() {
  console.log(`\n${paint(BOLD, "Свежесть зависимостей")}`)
  const pkg = readJson(join(root, "package.json"))
  const lock = readJson(join(root, "package-lock.json"))
  const vendored = readJson(join(root, "node_modules", ".package-lock.json"))

  if (!pkg) {
    line("FAIL", "нет package.json")
    problems.push("нет package.json")
    return
  }

  if (!lock) {
    line("FAIL", "нет package-lock.json — прогон невоспроизводим")
    problems.push("нет package-lock.json")
  } else if (lock.version !== pkg.version) {
    line("FAIL", `package-lock.json отстал: в нём ${lock.version}, в package.json ${pkg.version} — пересоберите: npm install --package-lock-only`)
    problems.push(`package-lock.json ${lock.version} против package.json ${pkg.version}`)
  } else {
    line("OK", `package-lock.json совпадает с package.json (${pkg.version})`)
  }

  if (!vendored) {
    line("FAIL", "нет node_modules/.package-lock.json — зависимости не установлены: npm ci")
    problems.push("зависимости не установлены")
  } else {
    const stale = []
    for (const [path, entry] of Object.entries(lock?.packages ?? {})) {
      if (!path.startsWith("node_modules/")) continue
      const installed = readJson(join(root, path, "package.json"))
      if (!installed) {
        stale.push(`${path}: не установлен`)
      } else if (entry.version && installed.version !== entry.version) {
        stale.push(`${path}: стоит ${installed.version}, в замке ${entry.version}`)
      }
    }
    if (stale.length) {
      for (const item of stale) line("FAIL", item)
      problems.push(`node_modules разошёлся с замком: ${stale.length} пакетов`)
    } else {
      const count = Object.keys(lock?.packages ?? {}).filter((path) => path.startsWith("node_modules/")).length
      line("OK", `node_modules совпадает с замком (${count} пакетов)`)
    }
  }

  if (!withRegistry) {
    line("--", "реестр npm не опрошен (нужен --registry); проверка офлайн")
    return
  }
  const published = spawnSync("npm", ["view", pkg.name, "version"], { encoding: "utf8", timeout: 60000 })
  const latest = String(published.stdout ?? "").trim()
  if (published.error || published.status !== 0 || !latest) {
    line("WARN", `реестр npm недоступен: ${String(published.stderr ?? "").split("\n")[0] || "нет ответа"}`)
  } else if (latest === pkg.version) {
    line("OK", `в реестре ${latest} — рабочая копия не отстала`)
  } else {
    line("WARN", `в реестре ${latest}, здесь ${pkg.version}`)
  }
}

/* ── печать ───────────────────────────────────────────────────────────────── */

const MARK = {
  OK: paint(GREEN, "OK  "),
  FAIL: paint(RED, "FAIL"),
  WARN: paint(YELLOW, "WARN"),
  "--": paint(DIM, "--  "),
}

function line(mark, text) {
  console.log(`    ${MARK[mark] ?? mark} ${text}`)
}

/** Русское склонение по числу: 1 цель, 2 цели, 5 целей. */
function plural(n, one, few, many) {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

function pad(text, width) {
  const value = String(text)
  return value.length >= width ? value : value + " ".repeat(width - value.length)
}

/* ── основной ход ─────────────────────────────────────────────────────────── */

const targets = (await loadTargets()).sort((a, b) => a.id.localeCompare(b.id))
const files = testFilesByTarget()

console.log(`\n${paint(BOLD, `Бэкенды кодогенерации: ${targets.length} целей`)}`)
console.log(`  ${pad("ЦЕЛЬ", 12)} ${pad("ПРОБА", 24)} ${pad("СТАТУС", 6)} ВЕРСИЯ ИЛИ ПРИЧИНА`)
console.log(`  ${"-".repeat(96)}`)

const present = []
const absent = []
for (const target of targets) {
  const probe = (target.toolchain?.probe ?? []).join(" ") || "(пробы нет)"
  const { available, version } = probeToolchain(target)
  if (available) {
    present.push(target)
    console.log(`  ${pad(target.id, 12)} ${pad(probe, 24)} ${paint(GREEN, pad("ЕСТЬ", 6))} ${String(version).slice(0, 52)}`)
  } else {
    absent.push(target)
    const reason = available === null ? "проба не задана — тулчейн не проверяется" : `«${target.toolchain.probe[0]}» не запускается`
    console.log(`  ${pad(target.id, 12)} ${pad(probe, 24)} ${paint(RED, pad("НЕТ", 6))} ${reason}`)
  }
}

let hidden = 0
const hiddenByTarget = []
if (absent.length && !fast) {
  for (const target of absent) {
    const targetFiles = files.get(target.id) ?? []
    if (!targetFiles.length) {
      hiddenByTarget.push({ id: target.id, count: 0, files: 0 })
      continue
    }
    const { count } = countHiddenTests(targetFiles)
    hidden += count
    hiddenByTarget.push({ id: target.id, count, files: targetFiles.length })
  }
}

console.log("")
console.log(
  `  ${paint(BOLD, "Проверяется по-настоящему:")} ${present.length} из ${targets.length} — ${present.map((t) => t.id).join(", ") || "ни одной"}`,
)
if (absent.length === 0) {
  console.log(`  ${paint(BOLD, "Пропускается:")}              0 из ${targets.length} — пропусков по тулчейнам не будет`)
} else {
  const reasons = absent.map((t) => `${t.id} (нет ${t.toolchain?.probe?.[0] ?? "?"})`).join(", ")
  console.log(`  ${paint(BOLD, "Пропускается:")}              ${absent.length} из ${targets.length} — ${reasons}`)
  if (fast) {
    console.log(`  ${paint(BOLD, "Скрыто тестов:")}             не измерено (--fast)`)
  } else {
    const detail = hiddenByTarget.map((item) => `${item.id} ${item.count}`).join(", ")
    console.log(`  ${paint(BOLD, "Скрыто тестов:")}             ${hidden} — ${detail}`)
  }
}

const required = requiredToolchains()
if (required.length) {
  console.log(`  ${paint(BOLD, "Требуются обязательно:")}     FTS_REQUIRE_TOOLCHAINS=${process.env.FTS_REQUIRE_TOOLCHAINS}`)
}

for (const target of absent) {
  if (toolchainRequired(target.id)) problems.push(`тулчейн «${target.id}» объявлен обязательным, но его нет`)
  else if (strict) problems.push(`нет тулчейна «${target.id}»`)
}

checkDependencies()

console.log("")
if (problems.length === 0) {
  const tail = absent.length
    ? ` (${absent.length} ${plural(absent.length, "цель пропустится", "цели пропустятся", "целей пропустятся")} осознанно)`
    : ""
  console.log(`${paint(BOLD, "ИТОГ")}  препятствий нет${tail}\n`)
  process.exit(0)
}
console.log(`${paint(BOLD, "ИТОГ")}  препятствий: ${problems.length}`)
for (const problem of problems) console.log(`    ${paint(RED, "•")} ${problem}`)
console.log(
  strict
    ? `\nПрогон остановлен до начала: измерять на неполном наборе тулчейнов — значит получить\nзелёный набор, который ничего не проверил. Поставьте недостающее, укажите каталог в\nFTS_TOOLCHAIN_PATH или прогоните на хосте, где всё есть: scripts/test-remote.sh\n`
    : `\nЭто предупреждение, не остановка. Чтобы отсутствие тулчейна валило прогон:\nFTS_REQUIRE_TOOLCHAINS=all npm test — или прогон целиком на удалённом хосте:\nscripts/test-remote.sh\n`,
)
process.exit(strict ? 1 : 0)
