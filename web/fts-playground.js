/**
 * <fts-playground> — the FTS compiler as an embeddable element.
 *
 *   <script type="module" src="fts-playground.js"></script>
 *   <fts-playground view="run">
 *     категория «Продажи»
 *       объект Покупка
 *         сумма является деньгами
 *   </fts-playground>
 *
 * The whole compiler runs in the reader's tab: 88 KB of ES modules, no server,
 * no dependency, nothing to install. Three decisions follow from wanting this to
 * drop into somebody else's documentation the way a mermaid block does:
 *
 * 1. Shadow DOM. The host page cannot leak styles in and the component cannot
 *    leak styles out. A docs theme that styles `pre` or `button` globally — most
 *    of them do — leaves the playground alone.
 * 2. Lazy runtime. The compiler is imported when the element scrolls into view
 *    (or when the reader focuses the editor first), so a page with twenty models
 *    downloads the compiler once, and only if a reader ever gets there.
 * 3. Text in, events out. The model is the element's text content, and results
 *    leave through `fts:compiled`, `fts:error` and `fts:result` — the host page
 *    never has to reach into the shadow root.
 */
import {
  VIEWS,
  collectInput,
  decodeSource,
  dedent,
  describeForm,
  diagnosticsOf,
  encodeSource,
  escapeHtml,
  formatValue,
  labels,
  parseAttributes,
  resolveView,
  slug,
  stepView,
  summarize,
} from "./fts-core.js"
import { styles } from "./fts-styles.js"

/** Default location of the compiler, resolved next to this module. */
const DEFAULT_RUNTIME = new URL("./vendor/fts/browser.js", import.meta.url).href

/* One import per URL, shared by every element on the page. */
const runtimes = new Map()

function loadRuntime(url) {
  if (!runtimes.has(url)) runtimes.set(url, import(/* @vite-ignore */ /* webpackIgnore: true */ url))
  return runtimes.get(url)
}

let mermaidLoading = null

function loadMermaid(url, theme) {
  if (globalThis.mermaid) return Promise.resolve(globalThis.mermaid)
  if (!url) return Promise.reject(new Error("no mermaid url configured"))
  if (!mermaidLoading) {
    mermaidLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script")
      script.src = url
      script.addEventListener("load", () => {
        if (!globalThis.mermaid) return reject(new Error("mermaid did not register"))
        globalThis.mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: theme === "dark" ? "dark" : "neutral",
          flowchart: { htmlLabels: false, curve: "basis" },
        })
        resolve(globalThis.mermaid)
      })
      script.addEventListener("error", () => reject(new Error("mermaid failed to load")))
      document.head.append(script)
    })
  }
  return mermaidLoading
}

let counter = 0

export class FtsPlayground extends HTMLElement {
  static observedAttributes = ["src", "context-src", "view", "views", "readonly", "height", "theme", "lang", "runtime", "mermaid", "eager"]

  /** Page-wide overrides, e.g. `FtsPlayground.defaults.mermaid = "/js/mermaid.min.js"`. */
  static defaults = { runtime: DEFAULT_RUNTIME, mermaid: null }

  #config = parseAttributes({})
  #text = labels("en")
  #uid = `fts-${++counter}`
  #source = ""
  #context = ""
  #model = null
  #compiler = null
  #timer = 0
  #started = false
  #observer = null
  #mutations = null
  #renders = 0
  #utility = null
  #values = {}
  #diagramFor = -1
  #nodes = {}
  #failure = null
  #elapsed = 0

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    style.textContent = styles
    shadow.append(style)
  }

  /* --- element lifecycle ------------------------------------------------- */

  connectedCallback() {
    this.#config = parseAttributes(this.#attributes())
    this.#text = labels(this.#config.language || this.closest("[lang]")?.getAttribute("lang") || document.documentElement.lang || "en")
    /* The model has to be read before the skeleton is built: #build() fills the
       editor from #source, and reading the light DOM afterwards would leave the
       reader looking at an empty textarea while the panels showed a compiled
       model. */
    if (this.#source === "") this.#source = dedent(this.textContent || "")
    if (!this.#nodes.frame) this.#build()
    this.#applyConfig()
    this.#applyShared()
    this.#watchText()
    this.#arm()
  }

  disconnectedCallback() {
    /* Frameworks move elements rather than re-create them, so both observers are
       dropped *and* forgotten: keeping the objects around would leave a
       re-attached component silently unwatched. */
    this.#observer?.disconnect()
    this.#observer = null
    this.#mutations?.disconnect()
    this.#mutations = null
    globalThis.clearTimeout(this.#timer)
  }

  attributeChangedCallback(name, previous, value) {
    if (previous === value || !this.#nodes.frame) return
    const before = this.#config
    this.#config = parseAttributes(this.#attributes())
    /* Any attribute change re-reads all of them, and `view` is also changed by
       clicking a tab. Without this the next `height` change would silently throw
       the reader back to whatever tab the markup asked for. */
    if (name !== "view") this.#config.view = resolveView(before.view, this.#config.views)
    if (name === "lang") {
      this.#text = labels(this.#config.language || document.documentElement.lang || "en")
      this.#build()
      this.#applyConfig()
      this.#render()
      return
    }
    if (name === "readonly" || name === "views") {
      this.#build()
      this.#applyConfig()
      this.#render()
      return
    }
    this.#applyConfig()
    if (name === "src" && this.#config.src !== before.src) {
      this.#loadSource().catch((error) => this.#fail(error))
      return
    }
    if (name === "context-src" && this.#config.contextSrc !== before.contextSrc) {
      this.#loadContext().then(() => this.#render()).catch((error) => this.#fail(error))
      return
    }
    if (name === "view") this.#select(this.#config.view, false)
  }

  #attributes() {
    const attributes = {}
    for (const name of FtsPlayground.observedAttributes) {
      if (this.hasAttribute(name)) attributes[name] = this.getAttribute(name)
    }
    return attributes
  }

  /* --- public surface ----------------------------------------------------- */

  /** The model source. Assigning it recompiles without touching the light DOM. */
  get value() {
    return this.#source
  }

  set value(text) {
    this.#source = String(text ?? "")
    if (this.#nodes.editor) this.#writeEditor()
    this.#start()
  }

  /** Last successfully compiled document, or null. */
  get model() {
    return this.#model
  }

  get view() {
    return this.#config.view
  }

  set view(name) {
    this.setAttribute("view", name)
  }

  /** Forces the runtime to load and returns the compiled document. */
  async compile() {
    await this.#start()
    if (!this.#model) throw new Error("model did not compile")
    return this.#model
  }

  /** Runs a utility from the page: `element.run("Рассчитать скидку", { сумма: 20000 })`. */
  async run(utility, input) {
    const compiler = await this.#runtime()
    const model = this.#model ?? (await this.compile())
    return compiler.executeUtility(model, utility, input)
  }

  /* --- skeleton ----------------------------------------------------------- */

  #build() {
    const shadow = this.shadowRoot
    for (const node of [...shadow.children]) if (node.tagName !== "STYLE") node.remove()

    const text = this.#text
    const views = this.#config.views
    const frame = document.createElement("div")
    frame.className = "frame"
    frame.setAttribute("part", "frame")

    const editorPane = document.createElement("div")
    editorPane.className = "pane"
    editorPane.setAttribute("part", "editor")
    editorPane.innerHTML = `
      <div class="bar" part="toolbar">
        <span class="name" part="filename"></span>
        ${/* Nothing to reset when there is no editor. */ ""}
        ${this.#config.readonly ? "" : `<button type="button" data-action="reset" part="button">${escapeHtml(text.reset)}</button>`}
        <button type="button" data-action="copy" part="button">${escapeHtml(text.copy)}</button>
      </div>
      <div class="editor">${
        this.#config.readonly
          ? `<pre class="source" part="source" tabindex="0" aria-label="${escapeHtml(text.source)}"></pre>`
          : `<label class="visually-hidden" for="${this.#uid}-source">${escapeHtml(text.source)}</label>
             <textarea id="${this.#uid}-source" part="source" spellcheck="false" autocapitalize="off" autocorrect="off" wrap="off"></textarea>`
      }</div>
      <p class="status" part="status" role="status" data-tone="">${escapeHtml(text.idle)}</p>`

    const outputPane = document.createElement("div")
    outputPane.className = "pane"
    outputPane.setAttribute("part", "output")
    outputPane.innerHTML = `
      <div role="tablist" part="tabs" aria-label="${escapeHtml(text.tabs)}">${views
        .map(
          (view) =>
            `<button type="button" role="tab" part="tab" id="${this.#uid}-tab-${view}" aria-controls="${this.#uid}-panel-${view}" aria-selected="false" tabindex="-1" data-view="${view}">${escapeHtml(
              text[view],
            )}</button>`,
        )
        .join("")}</div>
      ${views
        .map(
          (view) =>
            `<div role="tabpanel" part="panel" id="${this.#uid}-panel-${view}" aria-labelledby="${this.#uid}-tab-${view}" tabindex="0" data-panel="${view}" hidden></div>`,
        )
        .join("")}`

    frame.append(editorPane, outputPane)
    shadow.append(frame)

    this.#nodes = {
      frame,
      name: editorPane.querySelector(".name"),
      editor: editorPane.querySelector("textarea, pre.source"),
      status: editorPane.querySelector(".status"),
      tabs: [...outputPane.querySelectorAll('[role="tab"]')],
      panels: new Map([...outputPane.querySelectorAll("[data-panel]")].map((panel) => [panel.dataset.panel, panel])),
    }

    this.#writeEditor()
    this.#wire(editorPane)
    this.#select(this.#config.view, false)
  }

  #wire(editorPane) {
    for (const tab of this.#nodes.tabs) {
      tab.addEventListener("click", () => this.#select(tab.dataset.view, false))
      tab.addEventListener("keydown", (event) => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
        if (step === 0) return
        event.preventDefault()
        /* Relative to the tab that has focus, not to the selected one: the two
           can differ when the reader tabs into the strip after a click. */
        this.#select(stepView(this.#config.views, tab.dataset.view, step), true)
      })
    }

    editorPane.querySelector('[data-action="reset"]')?.addEventListener("click", () => {
      this.#source = this.#config.src ? this.#source : dedent(this.textContent || "")
      if (this.#config.src) {
        this.#loadSource().catch((error) => this.#fail(error))
        return
      }
      this.#writeEditor()
      this.#start()
    })

    const copy = editorPane.querySelector('[data-action="copy"]')
    copy.addEventListener("click", async () => {
      const initial = copy.textContent
      try {
        await navigator.clipboard.writeText(this.#source)
        copy.textContent = this.#text.copied
      } catch {
        copy.textContent = this.#text.copyFailed
      }
      globalThis.setTimeout(() => {
        copy.textContent = initial
      }, 1600)
    })

    const editor = this.#nodes.editor
    if (editor.tagName === "TEXTAREA") {
      editor.addEventListener("input", () => {
        this.#source = editor.value
        this.#schedule()
      })
      /* Typing outruns scrolling: a reader who reaches the editor with the
         keyboard needs the compiler now, not when the observer fires. */
      editor.addEventListener("focus", () => this.#start(), { once: true })
    }
  }

  #writeEditor() {
    const editor = this.#nodes.editor
    if (!editor) return
    if (editor.tagName === "TEXTAREA") editor.value = this.#source
    else editor.textContent = this.#source
  }

  #applyConfig() {
    const { height, src } = this.#config
    this.#nodes.frame.style.height = height ?? ""
    this.#nodes.name.textContent = src ? src.split("/").pop() : "model.fts"
    for (const panel of this.#nodes.panels.values()) panel.style.maxHeight = height ? "none" : ""
  }

  /* --- shared links ------------------------------------------------------- */

  #applyShared() {
    /* `#fts=<base64url>` lets a reader hand somebody else the exact model they
       were looking at. Only the element addressed by `#fts-target` (or the first
       one on the page) takes it, so one link never rewrites every playground. */
    const match = /[#&]fts=([\w-]+)/.exec(globalThis.location?.hash || "")
    if (!match) return
    const target = new URLSearchParams((globalThis.location.hash || "").replace(/^#/, "")).get("fts-target")
    if (target && this.id !== target) return
    if (!target && document.querySelector("fts-playground") !== this) return
    try {
      this.#source = decodeSource(match[1])
      this.#writeEditor()
      this.#nodes.name.textContent = "shared.fts"
    } catch {
      /* A truncated link is not worth an error state: the inline model stands. */
    }
  }

  /** Share link for the current source, ready to hand to somebody. */
  shareLink() {
    const base = `${globalThis.location.origin}${globalThis.location.pathname}${globalThis.location.search}`
    const target = this.id ? `fts-target=${encodeURIComponent(this.id)}&` : ""
    return `${base}#${target}fts=${encodeSource(this.#source)}`
  }

  /* --- loading ------------------------------------------------------------ */

  #watchText() {
    if (this.#mutations) return
    this.#mutations = new MutationObserver(() => {
      if (this.#config.src) return
      const next = dedent(this.textContent || "")
      if (next === this.#source) return
      this.#source = next
      this.#writeEditor()
      if (this.#started) this.#schedule()
    })
    this.#mutations.observe(this, { childList: true, characterData: true, subtree: true })
  }

  /**
   * Arms the lazy start.
   *
   * The compiler is 88 KB of ES modules; a documentation page with a playground
   * in every chapter should not pay for it until a reader actually arrives at
   * one. `rootMargin` starts the download slightly before the element is visible,
   * so the first paint of the panel usually beats the scroll.
   */
  #arm() {
    if (!this.#config.lazy || !("IntersectionObserver" in globalThis)) {
      this.#start()
      return
    }
    this.#observer?.disconnect()
    this.#observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        this.#observer.disconnect()
        this.#start()
      },
      { rootMargin: "400px" },
    )
    this.#observer.observe(this)
  }

  #runtime() {
    const url = this.#config.runtime || FtsPlayground.defaults.runtime
    return loadRuntime(new URL(url, document.baseURI).href).then((module) => {
      this.#compiler = module
      return module
    })
  }

  async #start() {
    /* Never rejects: it is called from event handlers and from the `value`
       setter, where a rejected promise would go nowhere but the console. */
    if (this.#started) return this.#update().catch((error) => this.#fail(error))
    this.#started = true
    this.#observer?.disconnect()
    this.#status(this.#text.loading, "busy")
    try {
      await this.#runtime()
      this.dispatchEvent(new CustomEvent("fts:ready", { bubbles: true, composed: true, detail: { runtime: this.#config.runtime || FtsPlayground.defaults.runtime } }))
      if (this.#config.src) await this.#loadSource({ silent: true })
      if (this.#config.contextSrc) await this.#loadContext()
      await this.#update()
    } catch (error) {
      this.#fail(error)
    }
  }

  async #loadSource({ silent = false } = {}) {
    const src = this.#config.src
    if (!src) return
    this.#status(this.#text.loading, "busy")
    const response = await fetch(new URL(src, document.baseURI).href)
    if (!response.ok) throw new Error(`${src} — ${response.status}`)
    this.#source = await response.text()
    this.#writeEditor()
    this.#nodes.name.textContent = src.split("/").pop()
    if (!silent) await this.#update()
  }

  async #loadContext() {
    const src = this.#config.contextSrc
    if (!src) return
    const response = await fetch(new URL(src, document.baseURI).href)
    if (!response.ok) throw new Error(`${src} — ${response.status}`)
    this.#context = await response.text()
  }

  #schedule() {
    globalThis.clearTimeout(this.#timer)
    /* Parsing takes a fraction of a millisecond, but repainting seven panels on
       every keystroke does not: a short pause keeps typing calm. */
    this.#timer = globalThis.setTimeout(() => {
      this.#update().catch((error) => this.#fail(error))
    }, 220)
  }

  /* --- the loop ----------------------------------------------------------- */

  async #update() {
    const compiler = this.#compiler ?? (await this.#runtime())
    const source = this.#source
    let failure = null
    const started = performance.now()
    try {
      this.#model = compiler.compile(source)
    } catch (error) {
      this.#model = null
      failure = error
    }
    const elapsed = performance.now() - started

    this.#failure = failure
    this.#elapsed = elapsed
    this.#renders += 1
    this.#render()
    /* The counter is the only thing an outside test can wait on without racing
       the debounce: it changes exactly once per completed recompilation. */
    this.dataset.ftsRenders = String(this.#renders)

    if (failure) {
      this.dispatchEvent(
        new CustomEvent("fts:error", {
          bubbles: true,
          composed: true,
          detail: { message: failure.message, diagnostics: diagnosticsOf(failure, this.#text), source },
        }),
      )
      return
    }
    const validation = compiler.validate(this.#model)
    this.dispatchEvent(
      new CustomEvent("fts:compiled", {
        bubbles: true,
        composed: true,
        detail: { model: this.#model, document: this.#model, valid: validation.valid, diagnostics: validation.diagnostics, source, elapsed },
      }),
    )
    if (!validation.valid) {
      this.dispatchEvent(
        new CustomEvent("fts:error", {
          bubbles: true,
          composed: true,
          detail: { message: this.#text.invalid, diagnostics: diagnosticsOf({ diagnostics: validation.diagnostics }, this.#text), source },
        }),
      )
    }
  }

  #render() {
    const compiler = this.#compiler
    if (!compiler) return
    const model = this.#model
    this.#renderCheck(compiler, model, this.#failure, this.#elapsed)
    this.#renderExamples(compiler, model)
    this.#renderRun(compiler, model)
    this.#renderTypeScript(compiler, model)
    this.#renderProof(compiler, model)
    this.#renderModel(model)
    this.#diagramFor = -1
    if (this.#config.view === "diagram") this.#renderDiagram()
  }

  #panel(view) {
    return this.#nodes.panels.get(view)
  }

  #select(view, focus) {
    const next = resolveView(view, this.#config.views)
    this.#config = { ...this.#config, view: next }
    for (const tab of this.#nodes.tabs) {
      const active = tab.dataset.view === next
      tab.setAttribute("aria-selected", String(active))
      tab.tabIndex = active ? 0 : -1
      if (active && focus) tab.focus()
    }
    for (const [name, panel] of this.#nodes.panels) panel.hidden = name !== next
    this.dataset.ftsView = next
    if (next === "diagram") this.#renderDiagram()
  }

  #status(message, tone) {
    this.#nodes.status.textContent = message
    this.#nodes.status.dataset.tone = tone || ""
  }

  #fail(error) {
    const message = String(error?.message || error)
    this.#status(message, "error")
    this.dispatchEvent(
      new CustomEvent("fts:error", { bubbles: true, composed: true, detail: { message, diagnostics: diagnosticsOf(error, this.#text), source: this.#source } }),
    )
  }

  #empty(message) {
    return `<p class="empty">${escapeHtml(message)}</p>`
  }

  #diagnostics(list) {
    return `<ul class="diagnostics">${list
      .map(
        (item) =>
          `<li><b>${escapeHtml(item.code)}</b><span>${escapeHtml(item.message)}</span>${item.place ? `<small>${escapeHtml(item.place)}</small>` : ""}</li>`,
      )
      .join("")}</ul>`
  }

  /* --- panels -------------------------------------------------------------- */

  #renderCheck(compiler, model, failure, elapsed) {
    const panel = this.#panel("check")
    const text = this.#text
    if (!panel) return
    if (failure) {
      panel.innerHTML = this.#diagnostics(diagnosticsOf(failure, text))
      this.#status(`${text.parseError}: ${failure.message}`, "error")
      return
    }
    const validation = compiler.validate(model)
    if (!validation.valid) {
      panel.innerHTML = this.#diagnostics(diagnosticsOf({ diagnostics: validation.diagnostics }, text))
      this.#status(text.invalid, "error")
      return
    }
    panel.innerHTML = `<dl class="facts">${summarize(model, elapsed, text)
      .map((fact) => `<div><dt>${escapeHtml(fact.term)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`)
      .join("")}</dl>`
    this.#status(`${text.ok} · ${elapsed.toFixed(2)} ${text.ms}`, "ok")
  }

  #renderExamples(compiler, model) {
    const panel = this.#panel("examples")
    const text = this.#text
    if (!panel) return
    if (!model || (model.utilities || []).length === 0) {
      panel.innerHTML = this.#empty(text.noExamples)
      return
    }
    let report
    try {
      report = compiler.testUtilities(model)
    } catch (error) {
      panel.innerHTML = this.#diagnostics(diagnosticsOf(error, text))
      return
    }
    panel.innerHTML = `
      <p class="verdict" data-tone="${report.valid ? "ok" : "error"}">${escapeHtml(text.passing(report.passed, report.total))}</p>
      <div class="scroll"><table>
        <thead><tr><th></th><th>${escapeHtml(text.utility)}</th><th>${escapeHtml(text.columnExample)}</th><th>${escapeHtml(
          text.columnExpected,
        )}</th><th>${escapeHtml(text.columnActual)}</th></tr></thead>
        <tbody>${report.results
          .map(
            (result) => `<tr class="${result.passed ? "pass" : "fail"}">
              <td>${result.passed ? "✓" : "✕"}</td>
              <td>${escapeHtml(result.utility)}</td>
              <td>${escapeHtml(result.example)}</td>
              <td>${escapeHtml(formatValue(result.expected))}</td>
              <td>${escapeHtml(result.error ?? formatValue(result.actual))}</td>
            </tr>`,
          )
          .join("")}</tbody>
      </table></div>`
  }

  #renderRun(compiler, model) {
    const panel = this.#panel("run")
    const text = this.#text
    if (!panel) return
    const form = describeForm(model, this.#utility, this.#values)
    if (!form.utility) {
      panel.innerHTML = this.#empty(text.noUtilities)
      return
    }
    this.#utility = form.utility

    panel.innerHTML = `
      <form class="run" part="form">
        <label class="utility"><span>${escapeHtml(text.utility)}</span>
          <select data-role="utility">${form.utilities
            .map((name) => `<option${name === form.utility ? " selected" : ""} value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
            .join("")}</select>
        </label>
        <fieldset><legend>${escapeHtml(form.input)}</legend>${form.fields.map((field) => this.#control(field)).join("")}</fieldset>
      </form>
      <output class="result" part="result"></output>`

    const element = panel.querySelector("form")
    const evaluate = () => this.#evaluate(compiler, model, form, panel)
    element.addEventListener("input", evaluate)
    element.addEventListener("change", (event) => {
      if (event.target.dataset.role === "utility") {
        this.#utility = event.target.value
        this.#values = {}
        this.#renderRun(compiler, model)
      } else evaluate()
    })
    evaluate()
  }

  #control(field) {
    const id = `${this.#uid}-field-${slug(field.name)}`
    const name = escapeHtml(field.name)
    if (field.control === "checkbox") {
      return `<label class="check" for="${id}"><input id="${id}" type="checkbox" data-field="${name}"${field.value ? " checked" : ""}><span>${name}</span><small>${escapeHtml(
        field.type,
      )}</small></label>`
    }
    return `<label class="field" for="${id}"><span>${name}</span><input id="${id}" type="${field.control}" data-field="${name}" value="${escapeHtml(
      field.value,
    )}"><small>${escapeHtml(field.type)}</small></label>`
  }

  #evaluate(compiler, model, form, panel) {
    const output = panel.querySelector("output")
    const values = {}
    for (const control of panel.querySelectorAll("[data-field]")) {
      values[control.dataset.field] = control.type === "checkbox" ? control.checked : control.value
    }
    this.#values = values
    const input = collectInput(form.fields, values)
    try {
      const started = performance.now()
      const value = compiler.executeUtility(model, form.utility, input)
      const elapsed = performance.now() - started
      output.dataset.tone = "ok"
      output.innerHTML = `<strong>${escapeHtml(formatValue(value))}</strong><small>${escapeHtml(form.output)} · ${elapsed.toFixed(3)} ${escapeHtml(
        this.#text.ms,
      )} · ${escapeHtml(JSON.stringify(input))}</small>`
      this.dispatchEvent(new CustomEvent("fts:result", { bubbles: true, composed: true, detail: { utility: form.utility, input, value, elapsed } }))
    } catch (error) {
      /* A violated property is a meaningful answer from the model, not a crash:
         it belongs where the result usually appears. */
      output.dataset.tone = "error"
      output.innerHTML = `<strong>${escapeHtml(this.#text.ruleFailed)}</strong><small>${escapeHtml(error.message)}</small>`
      this.dispatchEvent(
        new CustomEvent("fts:result", {
          bubbles: true,
          composed: true,
          detail: { utility: form.utility, input, error: error.message, diagnostics: diagnosticsOf(error, this.#text) },
        }),
      )
    }
  }

  #renderTypeScript(compiler, model) {
    const panel = this.#panel("typescript")
    if (!panel) return
    if (!model || (model.utilities || []).length === 0) {
      panel.innerHTML = this.#empty(this.#text.noTypescript)
      return
    }
    try {
      const generated = compiler.generateTypeScript(model)
      panel.innerHTML = generated.files
        .map(
          (file) =>
            `<figure class="generated"><figcaption>${escapeHtml(file.path)}</figcaption><pre class="code"><code>${escapeHtml(file.content)}</code></pre></figure>`,
        )
        .join("")
    } catch (error) {
      panel.innerHTML = this.#diagnostics(diagnosticsOf(error, this.#text))
    }
  }

  #renderProof(compiler, model) {
    const panel = this.#panel("proof")
    const text = this.#text
    if (!panel) return
    if (!model || !model.proposition) {
      panel.innerHTML = this.#empty(text.noTheorem)
      return
    }
    const context = this.#context || "{}"
    panel.innerHTML = `
      <label class="context"><span>${escapeHtml(text.context)}</span>
        <textarea class="context" part="context" spellcheck="false">${escapeHtml(context)}</textarea>
      </label>
      <div data-role="proof"></div>`
    const editor = panel.querySelector("textarea")
    editor.addEventListener("input", () => {
      this.#context = editor.value
      this.#proveInto(compiler, model, panel.querySelector('[data-role="proof"]'))
    })
    this.#proveInto(compiler, model, panel.querySelector('[data-role="proof"]'))
  }

  #proveInto(compiler, model, holder) {
    const text = this.#text
    let context
    try {
      context = JSON.parse(this.#context || "{}")
    } catch (error) {
      holder.innerHTML = this.#diagnostics([{ code: "FTS_CONTEXT_JSON", message: text.badJson(error.message), place: "" }])
      return
    }
    try {
      const proof = compiler.prove(model, context)
      holder.innerHTML = `
        <p class="verdict" data-tone="ok">${escapeHtml(text.proved)}</p>
        <dl class="facts">
          <div><dt>${escapeHtml(text.proofPath)}</dt><dd>${escapeHtml(proof.proof)}</dd></div>
          <div><dt>${escapeHtml(text.proofMorphism)}</dt><dd>${escapeHtml(proof.categorical.morphism)}</dd></div>
          <div><dt>${escapeHtml(text.proofCurryHoward)}</dt><dd>${escapeHtml(proof.curry_howard.proposition)}</dd></div>
        </dl>`
      this.dispatchEvent(new CustomEvent("fts:result", { bubbles: true, composed: true, detail: { proof, context } }))
    } catch (error) {
      holder.innerHTML = `<p class="verdict" data-tone="error">${escapeHtml(text.denied)}</p>${this.#diagnostics(diagnosticsOf(error, text))}`
      this.dispatchEvent(
        new CustomEvent("fts:result", { bubbles: true, composed: true, detail: { proof: null, context, error: error.message, diagnostics: diagnosticsOf(error, text) } }),
      )
    }
  }

  #renderModel(model) {
    const panel = this.#panel("model")
    if (!panel) return
    panel.innerHTML = model ? `<pre class="code"><code>${escapeHtml(JSON.stringify(model, null, 2))}</code></pre>` : this.#empty(this.#text.noModel)
  }

  async #renderDiagram() {
    const panel = this.#panel("diagram")
    const text = this.#text
    if (!panel || !this.#compiler) return
    if (this.#diagramFor === this.#renders) return
    if (!this.#model) {
      panel.innerHTML = this.#empty(text.noModel)
      return
    }
    this.#diagramFor = this.#renders
    const source = this.#compiler.mermaidCategory(this.#model)
    panel.innerHTML = `<div class="diagram" data-role="diagram"></div>
      <details class="diagram-source"${globalThis.mermaid || this.#mermaidUrl() ? "" : " open"}>
        <summary>${escapeHtml(text.diagramSource)}</summary><pre class="code"><code>${escapeHtml(source)}</code></pre></details>`
    const holder = panel.querySelector('[data-role="diagram"]')
    try {
      const mermaid = await loadMermaid(this.#mermaidUrl(), this.#resolvedTheme())
      const { svg } = await mermaid.render(`${this.#uid}-diagram-${this.#renders}`, source)
      holder.innerHTML = svg
    } catch {
      /* The renderer is about a megabyte and may never arrive. The Mermaid text
         is already on screen, so the tab stays useful without a picture. */
      holder.innerHTML = this.#empty(text.diagramFallback)
    }
  }

  #mermaidUrl() {
    return this.#config.mermaid || FtsPlayground.defaults.mermaid
  }

  #resolvedTheme() {
    if (this.#config.theme !== "auto") return this.#config.theme
    return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
}

if (!customElements.get("fts-playground")) customElements.define("fts-playground", FtsPlayground)

export { VIEWS }
export default FtsPlayground
