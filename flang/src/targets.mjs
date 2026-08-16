/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Восемь целей печати и пробы их тулчейнов.
 *
 * ── Почему таблица, а не чтение каталога ────────────────────────────────────
 * Раньше список целей вычитывался из `tools/ftsc/src/emit/*.mjs`: каждый бэкенд
 * СТАРОГО проекта экспортировал `target` с пробой, и `scripts/preflight.mjs`
 * собирал таблицу оттуда. Старый проект вынесен из репозитория (тег
 * `fts-pered-udaleniem`), а печать flang (`flang/src/emit/*.mjs`) своих `target`
 * никогда не объявляла — печатать умеет, а как проверить напечатанное, не
 * знает. Поэтому проба переехала сюда данными.
 *
 * ── Почему это не «зашитая константа», которой боится репозиторий ───────────
 * Расходиться таблице не с чем: `id` целей называют сами проверки вызовом
 * `missingToolchain(t, "<id>", …)`, и `scripts/preflight.mjs` считает по ним
 * скрытые тесты. Цель без единого теста видна в отчёте нулём, цель с тестами и
 * без строки здесь — тем, что её нет в таблице вовсе. Оба расхождения видны
 * глазом в выводе, а не выводятся вычитанием.
 *
 * У `js` проба — сам Node, и она не украшение: она всегда отвечает «есть», и
 * это верно (JavaScript исполняет тот же Node, которым идёт прогон), но версия
 * в отчёте названа, а строка «js — пропускается» никогда не появляется. Строка
 * без пробы читалась бы в отчёте как «тулчейна нет», то есть ровно наоборот.
 */
import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import { extraBinDirectories } from "./toolchain.mjs"

/**
 * @type {{id: string, name: string, extension: string, toolchain: {probe: string[]|null}}[]}
 */
export const ЦЕЛИ = [
  /* `cc` есть в любой POSIX-системе; ею же собирается неподвижная точка
     самораскрутки (`flang/test/self-bootstrap.test.mjs`). */
  { id: "c", name: "C", extension: ".c", toolchain: { probe: ["cc", "--version"] } },
  { id: "csharp", name: "C#", extension: ".cs", toolchain: { probe: ["dotnet", "--version"] } },
  { id: "elixir", name: "Elixir", extension: ".ex", toolchain: { probe: ["elixir", "--version"] } },
  { id: "go", name: "Go", extension: ".go", toolchain: { probe: ["go", "version"] } },
  { id: "java", name: "Java", extension: ".java", toolchain: { probe: ["javac", "--version"] } },
  { id: "js", name: "JavaScript", extension: ".mjs", toolchain: { probe: ["node", "--version"] } },
  { id: "python", name: "Python", extension: ".py", toolchain: { probe: ["python3", "--version"] } },
  { id: "rust", name: "Rust", extension: ".rs", toolchain: { probe: ["rustc", "--version"] } },
]

/* Копия, а не сама таблица: вызывающий вправе её отсортировать, а сортировка на
   месте испортила бы порядок всем остальным. */
export const loadTargets = () => ЦЕЛИ.map((цель) => ({ ...цель }))

/* Сколько ждать ответа пробы. Двадцати секунд хватает почти всем, но не всем:
   `elixir --version` поднимает BEAM, и на загруженной машине это занимает
   больше минуты. Проба, упавшая по таймауту, неотличима от отсутствующего
   тулчейна — то есть даёт ровно ту ложь, ради борьбы с которой пробы и
   заведены. Поэтому запас большой, а переопределить его можно переменной. */
const PROBE_TIMEOUT_MS = Number(process.env.FTS_PROBE_TIMEOUT_MS) > 0 ? Number(process.env.FTS_PROBE_TIMEOUT_MS) : 120000

function run(command, args) {
  const direct = spawnSync(command, args, { encoding: "utf8", timeout: PROBE_TIMEOUT_MS })
  if (!direct.error && direct.status === 0) return direct
  for (const directory of extraBinDirectories()) {
    const candidate = resolve(directory, command)
    if (!existsSync(candidate)) continue
    const result = spawnSync(candidate, args, { encoding: "utf8", timeout: PROBE_TIMEOUT_MS })
    if (!result.error && result.status === 0) return result
  }
  return direct
}

/* Строка версии — та, что про этот тулчейн, а не просто первая.
   `elixir --version` начинает с баннера Erlang, и отчёт показывал версию OTP
   там, где обещал версию Elixir. Мелочь, но того же рода, что и все ошибки,
   ради которых этот код написан: ответ не о том, о чём спрашивали. */
function versionLine(text, target) {
  const lines = String(text).split("\n").map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return null
  const hasNumber = (line) => /\d+\.\d+/u.test(line)
  const wanted = [target.name, target.id, target.toolchain?.probe?.[0]]
    .filter(Boolean)
    .map((word) => String(word).toLowerCase())
  const named = lines.find((line) => hasNumber(line) && wanted.some((word) => line.toLowerCase().includes(word)))
  return named ?? lines.find(hasNumber) ?? lines[0]
}

/** Есть ли в системе тулчейн, которым можно проверить напечатанное. */
export function probeToolchain(target) {
  const probe = target.toolchain?.probe
  if (!probe?.length) return { available: null, version: null }
  const result = run(probe[0], probe.slice(1))
  if (result.error || result.status !== 0) return { available: false, version: null }
  return { available: true, version: versionLine(result.stdout || result.stderr, target) }
}
