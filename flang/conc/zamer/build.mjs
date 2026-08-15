/**
 * Печать стенда в C и сборка: замеряет и стенку компиляции тоже.
 * Числа времени — процессорное время каждой стадии, в миллисекундах.
 */
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs"
import { join } from "node:path"

const дов = new Map()
for (const кусок of process.argv.slice(2)) {
  const [имя, значение] = кусок.replace(/^--/, "").split("=")
  дов.set(имя, значение)
}

const корень = дов.get("root")
const исходник = дов.get("src")
const каталог = дов.get("dir")

const { parse } = await import(`${корень}/flang/src/parser.mjs`)
const { emitC } = await import(`${корень}/flang/src/emit/c.mjs`)

function процессорное() {
  const u = process.cpuUsage()
  return (u.user + u.system) / 1000
}

const текст = readFileSync(исходник, "utf8")
const t0 = процессорное()
const программа = parse(текст, "стенд.flang")
const t1 = процессорное()
const напечатано = emitC(программа)
const t2 = процессорное()

mkdirSync(каталог, { recursive: true })
for (const файл of напечатано.files) writeFileSync(join(каталог, файл.path), файл.content, "utf8")
const t3 = процессорное()

const исходникиC = напечатано.files.filter((ф) => ф.path.endsWith(".c")).map((ф) => ф.path)
const начало = Date.now()
execFileSync("cc", ["-O2", "-std=c99", ...исходникиC, "-o", "flang_cli", "-lm"], {
  cwd: каталог,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  maxBuffer: 256 * 1024 * 1024,
})
const ccМс = Date.now() - начало

const байтC = напечатано.files
  .filter((ф) => ф.path.endsWith(".c") || ф.path.endsWith(".h"))
  .reduce((с, ф) => с + Buffer.byteLength(ф.content, "utf8"), 0)

console.log(JSON.stringify({
  исходникБайт: Buffer.byteLength(текст, "utf8"),
  разборМс: +(t1 - t0).toFixed(1),
  печатьМс: +(t2 - t1).toFixed(1),
  записьМс: +(t3 - t2).toFixed(1),
  напечатаноБайт: байтC,
  ccМс,
  бинарникБайт: statSync(join(каталог, "flang_cli")).size,
}))
