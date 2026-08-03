/**
 * Copies the browser-safe compiler surface from `dist/src` into `web/vendor/fts`.
 *
 * The web component must work with no bundler and no npm step on the consumer
 * side, so the runtime it lazily imports has to be a plain directory of ES
 * modules that any static server (or a CDN mirroring the repository) can serve.
 * Only the modules reachable from `browser.js` are copied: `certificate.ts`,
 * `cli.ts` and `mcp.ts` need node:crypto / node:fs and must never reach a page.
 *
 * Usage: npm run build && node web/scripts/vendor-runtime.mjs
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const web = resolve(fileURLToPath(new URL("../", import.meta.url)))
const root = resolve(web, "..")
const source = join(root, "dist", "src")
const target = join(web, "vendor", "fts")
const entry = "browser.js"

if (!readdirSync(source).includes(entry)) {
  throw new Error("dist/src/browser.js is missing — run `npm run build` first")
}

/* Follow the static import graph instead of copying dist/src wholesale: the
   vendored copy is a promise that nothing in it touches Node.js APIs. */
const emitted = new Set(readdirSync(source).filter((name) => name.endsWith(".js")))
const collected = new Map()
const queue = [entry]
while (queue.length > 0) {
  const name = queue.shift()
  if (collected.has(name)) continue
  const text = readFileSync(join(source, name), "utf8")
  collected.set(name, text)
  /* Only statements at the start of a line are real imports. The code generator
     emits `import … from "./fts.utilities.js"` inside a template literal, and a
     naive scan would try to vendor that non-existent module. */
  for (const match of text.matchAll(/^(?:import|export)[^\n]*?from "(\.\/[^"]+\.js)"/gm)) {
    const dependency = match[1].slice(2)
    if (emitted.has(dependency)) queue.push(dependency)
  }
}

rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })

let bytes = 0
const modules = [...collected.keys()].sort()
for (const name of modules) {
  /* Source maps point at TypeScript files that are not published here; leaving
     the comment behind would make every page log a 404 in devtools. */
  const code = collected.get(name).replace(/^\/\/# sourceMappingURL=.*$/gm, "").trimEnd() + "\n"
  writeFileSync(join(target, name), code)
  bytes += Buffer.byteLength(code)
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
writeFileSync(
  join(target, "manifest.json"),
  `${JSON.stringify(
    {
      package: packageJson.name,
      version: packageJson.version,
      surface: "browser",
      generator: "web/scripts/vendor-runtime.mjs",
      modules,
      bytes,
    },
    null,
    2,
  )}\n`,
)

/* A `type: module` marker keeps the directory importable when it is copied into
   a project that is otherwise CommonJS. */
writeFileSync(join(target, "package.json"), `${JSON.stringify({ type: "module" }, null, 2)}\n`)

process.stdout.write(`vendored ${modules.length} modules, ${(bytes / 1024).toFixed(1)} KB → ${target.slice(dirname(web).length + 1)}\n`)
