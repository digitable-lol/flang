/**
 * Поиск тулчейнов целевых языков.
 *
 * Бэкенды проверяются настоящими компиляторами, а те не всегда лежат в `PATH`:
 * Go, JDK и Elixir часто ставят рядом с домашним каталогом. Машинно-зависимые
 * пути в коде репозитория недопустимы, поэтому список дополнительных каталогов
 * собирается из переменной окружения `FTS_TOOLCHAIN_PATH` и общеизвестных мест
 * установки. Если тулчейна нет — тест честно пропускается, а не притворяется
 * пройденным.
 */
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { delimiter, join } from "node:path"

const WELL_KNOWN = ["/usr/local/go/bin", "/usr/lib/jvm/default/bin", "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"]

/** Каталоги, где имеет смысл искать компилятор помимо `PATH`. */
export function extraBinDirectories() {
  const configured = String(process.env.FTS_TOOLCHAIN_PATH ?? "")
    .split(delimiter)
    .filter(Boolean)
  const home = homedir()
  const inHome = home ? [join(home, ".local", "bin"), join(home, "go", "bin")] : []
  return [...configured, ...inHome, ...WELL_KNOWN]
}

/** Абсолютный путь к исполняемому файлу или `null`, если его нет в системе. */
export function findExecutable(name, extra = []) {
  for (const directory of String(process.env.PATH ?? "").split(delimiter)) {
    if (!directory) continue
    const candidate = join(directory, name)
    if (existsSync(candidate)) return candidate
  }
  for (const directory of [...extra, ...extraBinDirectories()]) {
    const candidate = join(directory, name)
    if (existsSync(candidate)) return candidate
  }
  return null
}
