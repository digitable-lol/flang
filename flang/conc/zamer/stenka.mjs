/**
 * Где стенка печати: наименьшее число сообщений в «дано», на котором emitC ещё
 * падает/уже падает. Двоичный поиск, каждый шаг — настоящая печать.
 */
import { execFileSync } from "node:child_process"

const S = "/tmp/claude-1000/-home-a-projects-flang/9eb12cf5-ca30-4673-b8b0-88b76eecfdac/scratchpad/zamer"
const W = "/home/a/projects/flang/.claude/worktrees/agent-a0860b9ee28929af8"

const { parse } = await import(`${W}/flang/src/parser.mjs`)
const { emitC } = await import(`${W}/flang/src/emit/c.mjs`)

function держит(n) {
  execFileSync(process.execPath, [`${S}/gen.mjs`, `--n=${n}`, "--вид=ждут", `--out=${S}/probe.flang`], {
    env: { ...process.env, LC_ALL: "C.UTF-8" },
  })
  const текст = execFileSync("cat", [`${S}/probe.flang`], { encoding: "utf8", maxBuffer: 1 << 30 })
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
