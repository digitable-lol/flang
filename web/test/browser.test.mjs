/**
 * Headless-browser regression for <fts-playground>.
 *
 * Custom elements, shadow DOM, IntersectionObserver and dynamic `import()` have
 * no meaningful stand-in in Node, so this test drives a real Chrome over a real
 * HTTP server and checks the demo page a reader would open. The scenario itself
 * lives in fixtures/demo-probe.mjs and is injected into the page by the server,
 * which keeps
 * web/demo/index.html free of test scaffolding.
 *
 * Two traps are worth naming, because both fail silently:
 *
 * 1. `execFileSync` would occupy the single Node thread, and the HTTP server in
 *    this same process would stop answering the browser. The browser is launched
 *    asynchronously instead.
 * 2. The default `maxBuffer` of 1 MB truncates `--dump-dom` on a page this size,
 *    and the JSON blob disappears without an error.
 *
 * Serving over HTTP rather than file:// is not a preference either: browsers
 * refuse to load ES modules from the file system, so file:// would test nothing.
 *
 * Run: node --test web/test/browser.test.mjs   (needs Chrome or Chromium)
 */
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { createServer } from "node:http"
import { delimiter, extname, join, normalize, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const web = resolve(fileURLToPath(new URL("../", import.meta.url)))

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".fts": "text/plain; charset=utf-8",
}

function browserExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean)
  for (const command of ["google-chrome", "chromium"]) {
    for (const entry of String(process.env.PATH || "").split(delimiter)) candidates.push(join(entry, command))
  }
  return candidates.find((candidate) => existsSync(candidate))
}

function serve() {
  const server = createServer((request, response) => {
    /* Keep-alive holds the connection open, so the headless browser never counts
       the load as finished and --dump-dom never happens. Every response closes. */
    response.setHeader("connection", "close")
    const path = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname)
    const relative = normalize(path.endsWith("/") ? `${path}index.html` : path)
      .replace(/^[/\\]+/, "")
      .replace(/^(\.\.[/\\])+/, "")
    const file = join(web, relative)
    if (!file.startsWith(web) || !existsSync(file)) {
      response.writeHead(404).end("not found")
      return
    }
    const body = readFileSync(file)
    if (relative === join("demo", "index.html")) {
      /* The scenario is mixed in on the fly: the demo file stays exactly what
         ships, and the browser still gets the probe. */
      response.writeHead(200, { "content-type": TYPES[".html"] })
      response.end(body.toString("utf8").replace("</body>", '<script type="module" src="/fixtures/demo-probe.mjs"></script></body>'))
      return
    }
    response.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" })
    response.end(body)
  })
  return server
}

async function dumpDom(chrome, url) {
  const { stdout } = await promisify(execFile)(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--mute-audio",
      "--virtual-time-budget=20000",
      "--window-size=1280,900",
      "--dump-dom",
      url,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180000, maxBuffer: 64 * 1024 * 1024 },
  )
  const match = stdout.match(/<pre id="fts-probe"[^>]*>([\s\S]*?)<\/pre>/)
  assert.ok(match && match[1], "the probe never reported: the module did not run in the browser")
  return JSON.parse(match[1].replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"'))
}

const chrome = browserExecutable()

test("the demo page works in a real browser", { skip: chrome ? false : "Chrome or Chromium is required", timeout: 200000 }, async () => {
  const server = serve()
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready))
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    const state = await dumpDom(chrome, `${origin}/demo/`)
    /* FTS_PROBE_DUMP=1 prints everything the browser saw — the only practical
       way to debug a scenario that runs inside a headless process. */
    if (process.env.FTS_PROBE_DUMP) console.log(JSON.stringify(state, null, 2))
    assert.ok(state.ok, `scenario failed at step «${state.steps.at(-1)}»: ${state.error} ${state.stack || ""}`)

    /* 1. A model written inside the tag compiles, in a shadow root. */
    assert.equal(state.inline.shadow, true, "the component must render into a shadow root")
    assert.equal(state.inline.lightDomText, true, "the model must stay readable in the light DOM")
    assert.equal(state.inline.tone, "ok", "the inline model must be reported valid")
    assert.equal(state.inline.model, "Продажи")
    assert.equal(state.inline.tabs, 7, `expected seven tabs, got ${state.inline.tabs}`)
    assert.equal(state.inline.tablist, true, "the tab strip must expose role=tablist")
    assert.equal(state.inline.labelled, true, "the editor must have a real <label>")
    assert.equal(state.inline.editor, true, "the editor must show the model, not just compile it")
    assert.match(state.inline.check, /Продажи/)

    /* 2. Lazy runtime. Both halves of the promise are covered: the component at
       the top of the page compiled without anyone touching it (the observer
       fired for what is on screen), and the one below the fold had not compiled
       at all by then. Whether a *scroll* delivers the observer callback is not
       asserted — under --virtual-time-budget that delivery is up to the
       browser's own scheduling, so the probe falls back to compile() and only
       reports which path won. */
    assert.equal(state.lazyPendingRemote, true, "the compiler must not run for components below the fold")
    assert.ok(["observer", "forced"].includes(state.wake.remote))

    /* 3. Every tab does its job. */
    assert.match(state.examples, /^3\/3 examples pass/, `examples tab reported «${state.examples}»`)
    assert.equal(state.run.tone, "ok")
    assert.match(state.run.text, /^3000/, `running the utility produced «${state.run.text}»`)
    assert.deepEqual(state.run.event, { utility: "Рассчитать скидку", value: 3000, error: null })
    assert.equal(state.typescript, true, "the TypeScript tab must show generated code")
    assert.equal(state.diagram, true, "the diagram tab must show the mermaid source even without a renderer")
    assert.equal(state.modelJson, true, "the JSON tab must show the canonical document")

    /* 4. Keyboard and live attributes. */
    assert.deepEqual(state.keyboard, { view: "examples", selected: "true" }, "ArrowRight must move the selected tab")
    assert.equal(state.attributeView, "proof", "changing the view attribute must switch the tab")
    assert.equal(state.attributeViewBack, "check", "and switch back")

    /* 5. Errors are shown and recovered from. */
    assert.equal(state.broken.tone, "error")
    assert.ok(state.broken.diagnostics >= 1, "a broken model must render diagnostics")
    assert.ok(state.broken.event.diagnostics >= 1, "fts:error must carry the diagnostics")
    assert.equal(state.recovered, "ok", "the component must recover after the model is fixed")

    /* 6. readonly drops the editor and keeps the results. */
    assert.equal(state.readonly.textarea, false, "readonly must not render an editor")
    assert.equal(state.readonly.source, true, "readonly must still show the model")
    assert.match(state.readonly.examples, /^2\/2 examples pass/)

    /* 7. The other load path: src + context-src, opened on the proof tab. */
    assert.equal(state.remote.file, "order-shipment.fts", `src loaded «${state.remote.file}»`)
    assert.equal(state.remote.view, "proof")
    assert.equal(state.remote.category, "Исполнение заказа")
    assert.equal(state.remote.proved, true, "the theorem must be proved on the shipped context")
    assert.equal(state.denied, true, "tampered data must lose the permission")

    /* 8. Themes are per component, not per page. */
    assert.notEqual(state.theme.light, state.theme.dark, "light and dark components must not share a palette")
    assert.equal(state.theme.views, 2, "views= must narrow the tab strip")

    /* 9. Fenced code blocks are upgraded the way mermaid upgrades its own. */
    assert.equal(state.auto.leftoverBlocks, 0, "no ```fts block may survive the upgrade")
    assert.equal(state.auto.readonly, true, "auto-upgraded blocks are read-only by default")
    assert.equal(state.auto.view, "run", "data-view on the script tag must reach the element")
    assert.equal(state.auto.category, "Кредитная политика")
    assert.match(state.auto.examples, /^2\/2 examples pass/)

    /* 10. The host page cannot restyle the component. */
    assert.match(state.isolation.page, /Comic Sans/, "the hostile page styles must apply to the page itself")
    assert.doesNotMatch(state.isolation.component, /Comic Sans/, "page styles must not cross the shadow boundary")
    assert.notEqual(state.isolation.componentBorder, "dashed", "page styles must not cross the shadow boundary")

    /* 11. Text swapped into the tag later recompiles; the scripting API works. */
    assert.deepEqual(state.mutation, { before: "Первая", after: "Вторая" })
    assert.equal(state.api.category, "Скрипт")
    assert.equal(state.api.share, true)

    /* 12. Events reached the page across the shadow boundary. */
    assert.ok(state.events.ready >= 1, "fts:ready must fire")
    assert.ok(state.events.compiled >= 6, `expected a compile event per component, got ${state.events.compiled}`)
    assert.ok(state.events.result >= 2, "fts:result must fire for utilities and proofs")
  } finally {
    server.close()
  }
})

test(
  "fts-auto upgrades the markup real generators emit",
  { skip: chrome ? false : "Chrome or Chromium is required", timeout: 200000 },
  async () => {
    const server = serve()
    await new Promise((ready) => server.listen(0, "127.0.0.1", ready))
    const origin = `http://127.0.0.1:${server.address().port}`
    try {
      const state = await dumpDom(chrome, `${origin}/fixtures/highlighters.html`)
      if (process.env.FTS_PROBE_DUMP) console.log(JSON.stringify(state, null, 2))
      assert.ok(state.ok, `fixture failed: ${state.error}`)

      /* One playground per generator, each carrying its own category name, so a
         missing shape is named rather than merely counted. */
      assert.deepEqual(state.categories, ["Мкдокс", "Прайм", "Хайлайт", "Хьюго", "Шики"])
      assert.equal(state.count, 5)
      assert.equal(state.readonly, true, "upgraded blocks are read-only unless asked otherwise")
      assert.equal(state.view, "check", "data-view on the script tag reaches the element")

      /* The JavaScript block is untouched, and no code-block chrome survives. */
      assert.deepEqual(state.leftover, ["language-js"], "only the fts blocks may be replaced")
      assert.equal(state.orphans, 0, "the wrapper chrome must go with the block it framed")
    } finally {
      server.close()
    }
  },
)
