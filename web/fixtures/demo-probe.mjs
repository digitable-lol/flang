/**
 * The browser half of the headless run.
 *
 * The test server injects this module at the end of web/demo/index.html, so it
 * drives the real demo page — the same file a reader opens — and writes one JSON
 * blob into a <pre> that `--dump-dom` can carry back to Node. Everything it
 * checks has to be read through `shadowRoot`, because that is exactly what a
 * host page would have to do, and because `--dump-dom` never serializes a shadow
 * tree by itself.
 */
const state = { steps: [], events: { compiled: 0, error: 0, result: 0, ready: 0 } }
const out = document.createElement("pre")
out.id = "fts-probe"
out.hidden = true
document.body.append(out)

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const text = (node) => (node ? node.textContent.replace(/\s+/g, " ").trim() : "")
const shadow = (id) => document.querySelector(`#${id}`).shadowRoot
const panel = (id, name) => shadow(id).querySelector(`[data-panel="${name}"]`)
const tab = (id, name) => shadow(id).querySelector(`[data-view="${name}"]`)

document.addEventListener("fts:ready", () => (state.events.ready += 1))
document.addEventListener("fts:compiled", (event) => {
  state.events.compiled += 1
  state.lastCompiled = { id: event.target.id, category: event.detail.model.category, valid: event.detail.valid }
})
document.addEventListener("fts:error", (event) => {
  state.events.error += 1
  state.lastError = { id: event.target.id, message: event.detail.message, diagnostics: event.detail.diagnostics.length }
})
document.addEventListener("fts:result", (event) => {
  state.events.result += 1
  state.lastResult = event.detail.proof !== undefined ? { proof: Boolean(event.detail.proof) } : { utility: event.detail.utility, value: event.detail.value ?? null, error: event.detail.error ?? null }
})

/**
 * Brings a component below the fold to life and reports which path did it.
 *
 * Scrolling is tried first, because that is what a reader does. Under
 * `--virtual-time-budget` the browser paints on its own schedule and an
 * IntersectionObserver callback may never be delivered, so the public
 * `compile()` — the same escape hatch a host page has — is the fallback. The
 * lazy behaviour itself is asserted elsewhere: the top component compiles
 * through the observer, and the one below the fold has not compiled at all.
 */
async function wake(element) {
  element.scrollIntoView()
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (element.dataset.ftsRenders) return "observer"
    await sleep(25)
  }
  await element.compile()
  return "forced"
}

async function rendered(element, previous = null) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const value = element.dataset.ftsRenders
    if (value && value !== previous) return value
    await sleep(25)
  }
  throw new Error(`${element.id || element.tagName} never recompiled`)
}

async function main() {
  await customElements.whenDefined("fts-playground")
  const inline = document.querySelector("#inline")
  const remote = document.querySelector("#remote")

  /* Lazy start: only the components near the top of the page may have run by
     the time the first one finishes. Sampled before anything is scrolled. */
  state.steps.push("lazy")
  state.lazyPendingRemote = !remote.dataset.ftsRenders

  state.steps.push("inline")
  await rendered(inline)
  state.inline = {
    shadow: Boolean(inline.shadowRoot),
    lightDomText: (inline.textContent || "").includes("категория"),
    tone: shadow("inline").querySelector(".status").dataset.tone,
    status: text(shadow("inline").querySelector(".status")),
    check: text(panel("inline", "check")).slice(0, 120),
    tabs: shadow("inline").querySelectorAll('[role="tab"]').length,
    tablist: Boolean(shadow("inline").querySelector('[role="tablist"]')),
    labelled: Boolean(shadow("inline").querySelector(`label[for="${shadow("inline").querySelector("textarea").id}"]`)),
    editor: shadow("inline").querySelector("textarea").value.trim().startsWith("категория"),
    model: inline.model.category,
  }

  state.steps.push("examples")
  tab("inline", "examples").click()
  state.examples = text(panel("inline", "examples")).slice(0, 40)

  state.steps.push("run")
  tab("inline", "run").click()
  await sleep(60)
  const form = panel("inline", "run")
  const amount = form.querySelector('input[type="number"]')
  amount.value = "20000"
  amount.dispatchEvent(new Event("input", { bubbles: true }))
  const loyal = form.querySelector('input[type="checkbox"]')
  loyal.checked = true
  loyal.dispatchEvent(new Event("input", { bubbles: true }))
  await sleep(60)
  const output = form.querySelector("output")
  state.run = { tone: output.dataset.tone, text: text(output).slice(0, 60), event: state.lastResult }

  state.steps.push("typescript")
  tab("inline", "typescript").click()
  state.typescript = text(panel("inline", "typescript")).includes("ftsUtilities")

  state.steps.push("diagram")
  tab("inline", "diagram").click()
  await sleep(60)
  state.diagram = text(panel("inline", "diagram")).includes("flowchart LR")

  state.steps.push("model-json")
  tab("inline", "model").click()
  state.modelJson = text(panel("inline", "model")).includes('"category"')

  /* Keyboard: the tab strip has to be usable without a mouse. */
  state.steps.push("keyboard")
  const first = tab("inline", "check")
  first.focus()
  first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
  state.keyboard = { view: document.querySelector("#inline").dataset.ftsView, selected: tab("inline", "examples").getAttribute("aria-selected") }

  /* The `view` attribute is live, not just an initial value. */
  state.steps.push("attribute")
  inline.setAttribute("view", "proof")
  state.attributeView = inline.dataset.ftsView
  inline.setAttribute("view", "check")
  state.attributeViewBack = inline.dataset.ftsView

  state.steps.push("broken")
  const editor = shadow("inline").querySelector("textarea")
  const valid = editor.value
  let renders = inline.dataset.ftsRenders
  editor.value = "категория «Продажи»\n  объектт Покупка\n"
  editor.dispatchEvent(new Event("input", { bubbles: true }))
  renders = await rendered(inline, renders)
  state.broken = {
    tone: shadow("inline").querySelector(".status").dataset.tone,
    diagnostics: panel("inline", "check").querySelectorAll("ul.diagnostics li").length,
    event: state.lastError,
  }

  state.steps.push("recovered")
  editor.value = valid
  editor.dispatchEvent(new Event("input", { bubbles: true }))
  await rendered(inline, renders)
  state.recovered = shadow("inline").querySelector(".status").dataset.tone

  /* Read-only mode: no editor at all, results still live. */
  state.steps.push("readonly")
  const frozen = document.querySelector("#frozen")
  state.wake = { frozen: await wake(frozen) }
  await rendered(frozen)
  state.readonly = {
    textarea: Boolean(frozen.shadowRoot.querySelector("textarea")),
    source: text(frozen.shadowRoot.querySelector("pre.source")).includes("Calculate discount"),
    examples: text(frozen.shadowRoot.querySelector('[data-panel="examples"]')).slice(0, 40),
  }

  /* Second load path: the model arrives over the network, not from the tag. */
  state.steps.push("src")
  state.wake.remote = await wake(remote)
  await rendered(remote)
  state.remote = {
    file: text(remote.shadowRoot.querySelector(".name")),
    tone: remote.shadowRoot.querySelector(".status").dataset.tone,
    view: remote.dataset.ftsView,
    proved: text(remote.shadowRoot.querySelector('[data-panel="proof"]')).includes("Theorem proved"),
    category: remote.model.category,
  }

  state.steps.push("denied")
  const context = remote.shadowRoot.querySelector("textarea.context")
  context.value = context.value.replace('"готов к отгрузке": true', '"готов к отгрузке": false')
  context.dispatchEvent(new Event("input", { bubbles: true }))
  await sleep(80)
  const proofPanel = text(remote.shadowRoot.querySelector('[data-panel="proof"]'))
  state.denied = proofPanel.includes("Permission denied") && proofPanel.includes("FTS_WITNESS_MISMATCH")

  /* Themes: two components, two palettes, one page. */
  state.steps.push("theme")
  const light = document.querySelector("#lightone")
  const dark = document.querySelector("#darkone")
  state.wake.theme = await wake(light)
  await wake(dark)
  await rendered(light)
  await rendered(dark)
  state.theme = {
    light: getComputedStyle(light.shadowRoot.querySelector(".frame")).backgroundColor,
    dark: getComputedStyle(dark.shadowRoot.querySelector(".frame")).backgroundColor,
    views: light.shadowRoot.querySelectorAll('[role="tab"]').length,
  }

  /* Auto-upgraded fenced block: the <pre> is gone, a playground took its place. */
  state.steps.push("auto")
  const upgraded = [...document.querySelectorAll("fts-playground")].find((element) => !element.id)
  state.wake.auto = await wake(upgraded)
  await rendered(upgraded)
  state.auto = {
    leftoverBlocks: document.querySelectorAll("pre > code.language-fts").length,
    readonly: upgraded.hasAttribute("readonly"),
    view: upgraded.getAttribute("view"),
    category: upgraded.model.category,
    examples: text(upgraded.shadowRoot.querySelector('[data-panel="examples"]')).slice(0, 40),
  }

  /* Shadow DOM isolation: the page turns hostile, the component does not care. */
  state.steps.push("isolation")
  document.querySelector("#hostile").click()
  await sleep(30)
  state.isolation = {
    page: getComputedStyle(document.querySelector("pre.snippet")).fontFamily,
    component: getComputedStyle(shadow("inline").querySelector("textarea")).fontFamily,
    componentBorder: getComputedStyle(shadow("inline").querySelector("textarea")).borderTopStyle,
  }
  document.querySelector("#hostile").click()

  /* A model typed into the tag after the fact must recompile — that is what a
     documentation site does when it swaps an article without a page load. */
  state.steps.push("mutation")
  const fresh = document.createElement("fts-playground")
  fresh.setAttribute("eager", "")
  fresh.setAttribute("views", "check")
  fresh.textContent = "категория «Первая»\n  объект Один\n    поле является строкой\n"
  document.body.append(fresh)
  const firstRender = await rendered(fresh)
  const before = fresh.model.category
  fresh.textContent = "категория «Вторая»\n  объект Два\n    поле является строкой\n"
  await rendered(fresh, firstRender)
  state.mutation = { before, after: fresh.model.category }

  /* Public API, the way a host page would script it. */
  state.steps.push("api")
  const scripted = document.createElement("fts-playground")
  scripted.setAttribute("eager", "")
  document.body.append(scripted)
  scripted.value = "категория «Скрипт»\n  объект Покупка\n    сумма является деньгами\n"
  const compiled = await scripted.compile()
  state.api = { category: compiled.category, share: scripted.shareLink().includes("#fts=") }

  state.ok = true
}

main()
  .catch((error) => {
    state.ok = false
    state.error = String(error && error.message ? error.message : error)
    state.stack = String(error && error.stack ? error.stack : "").split("\n").slice(0, 4).join(" | ")
  })
  .finally(() => {
    out.textContent = JSON.stringify(state)
  })
