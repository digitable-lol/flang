/**
 * Где стенка печати: наименьшее число сообщений в «дано», на котором emitC ещё
 * падает/уже падает. Двоичный поиск, каждый шаг — настоящая печать.
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

/* Свой каталог — отсюда берётся и генератор, и корень дерева. Черновик стенда
   кладётся в ZAMER (по умолчанию текущий каталог): на тридцати тысячах
   сообщений это восемь мегабайт, и в дереве им не место. */
const ЗДЕСЬ = fileURLToPath(new URL(".", import.meta.url))
const FLANG = process.env.FLANG ?? fileURLToPath(new URL("../../..", import.meta.url))
const ZAMER = process.env.ZAMER ?? process.cwd()

const { parse } = await import(`${FLANG}/flang/src/parser.mjs`)
const { emitC } = await import(`${FLANG}/flang/src/emit/c.mjs`)

const черновик = join(ZAMER, "probe.flang")

function держит(n) {
  execFileSync(process.execPath, [join(ЗДЕСЬ, "gen.mjs"), `--n=${n}`, "--вид=ждут", `--out=${черновик}`], {
    env: { ...process.env, LC_ALL: "C.UTF-8" },
  })
  const текст = readFileSync(черновик, "utf8")
  try {
    emitC(parse(текст, "probe.flang"))
    return { ok: true }
  } catch (беда) {
    return { ok: false, беда: `${беда.constructor.name}: ${беда.message}` }
  }
}

let низ = Number(process.argv[2] ?? 1000)
let верх = Number(process.argv[3] ?? 100000)
console.log(`низ ${низ}: ${JSON.stringify(держит(низ))}`)
console.log(`верх ${верх}: ${JSON.stringify(держит(верх))}`)
while (верх - низ > 1) {
  const середина = Math.floor((низ + верх) / 2)
  const итог = держит(середина)
  console.log(`${середина}: ${итог.ok ? "держит" : итог.беда}`)
  if (итог.ok) низ = середина
  else верх = середина
}
console.log(`ПОСЛЕДНЕЕ ХОРОШЕЕ ${низ}, ПЕРВОЕ ПЛОХОЕ ${верх}`)
console.log(JSON.stringify(держит(верх)))
