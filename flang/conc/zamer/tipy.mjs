/** Сколько стоит проверка типов на стенде: её в build.mjs нет, а в цепочке есть. */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
const W = process.env.FLANG ?? fileURLToPath(new URL("../../..", import.meta.url))
const { parse } = await import(`${W}/flang/src/parser.mjs`)
const типы = await import(`${W}/flang/src/types.mjs`)
const проверить = типы.checkTypes
const текст = readFileSync(process.argv[2], "utf8")
const мс = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000 }
const t0 = мс()
const программа = parse(текст, "стенд.flang")
const t1 = мс()
const итог = проверить(программа)
const t2 = мс()
console.log(JSON.stringify({
  разборМс: +(t1 - t0).toFixed(1),
  типыМс: +(t2 - t1).toFixed(1),
  диагностик: Array.isArray(итог) ? итог.length : (итог?.diagnostics?.length ?? "?"),
}))
