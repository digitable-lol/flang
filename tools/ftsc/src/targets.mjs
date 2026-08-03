/**
 * Реестр бэкендов кодогенерации.
 *
 * Бэкенды подключаются по факту наличия файла в src/emit: добавить язык — это
 * положить один модуль с контрактом из SPEC.md, а не править ядро. Поэтому
 * список строится чтением каталога, а не константой.
 */
import { readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { codes, fail } from "./diagnostics.mjs"
import { extraBinDirectories } from "./toolchain.mjs"

const emitDirectory = fileURLToPath(new URL("./emit/", import.meta.url))

export async function loadTargets() {
  let files = []
  try {
    files = (await readdir(emitDirectory)).filter((name) => name.endsWith(".mjs")).sort()
  } catch (_) {
    return []
  }

  const targets = []
  for (const file of files) {
    const module = await import(resolve(emitDirectory, file))
    if (!module.target?.id || typeof module.emit !== "function") continue
    targets.push({ ...module.target, emit: module.emit })
  }
  return targets
}

export async function loadTarget(id) {
  const target = (await loadTargets()).find((item) => item.id === id)
  if (!target) {
    const known = (await loadTargets()).map((item) => item.id).join(", ") || "нет ни одного"
    throw fail(codes.targetUnknown, `неизвестный целевой язык «${id}»; доступны: ${known}`)
  }
  return target
}

/* Тулчейн не всегда лежит в PATH: Go, JDK и Elixir часто ставят отдельно, и
   считать их отсутствующими было бы неверно. Дополнительные каталоги задаются
   переменной FTS_TOOLCHAIN_PATH (см. src/toolchain.mjs). */
function run(command, args) {
  const direct = spawnSync(command, args, { encoding: "utf8", timeout: 20000 })
  if (!direct.error && direct.status === 0) return direct
  for (const directory of extraBinDirectories()) {
    const candidate = resolve(directory, command)
    if (!existsSync(candidate)) continue
    const result = spawnSync(candidate, args, { encoding: "utf8", timeout: 20000 })
    if (!result.error && result.status === 0) return result
  }
  return direct
}

/** Есть ли в системе тулчейн, которым можно проверить сгенерированный код. */
export function probeToolchain(target) {
  const probe = target.toolchain?.probe
  if (!probe?.length) return { available: null, version: null }
  const result = run(probe[0], probe.slice(1))
  if (result.error || result.status !== 0) return { available: false, version: null }
  return { available: true, version: (result.stdout || result.stderr).split("\n")[0].trim() }
}
