/**
 * Turns fenced FTS code blocks into playgrounds — the mermaid deal.
 *
 *   <script type="module" src="fts-auto.js"></script>
 *
 * That one line is the whole integration. Every generator writes a fenced
 * ```fts block differently — Prism and Docusaurus emit `language-fts`, Chroma
 * (Hugo) emits `language-fts` inside a `.highlight` wrapper, highlight.js emits
 * `lang-fts`, some themes emit a bare `fts` class or `data-lang` — so all of
 * those spellings are matched instead of asking authors to change their markup.
 *
 * Blocks become `readonly` playgrounds by default: documentation prose stays
 * documentation prose, and the reader can still run the utility, read the
 * generated TypeScript, or check the theorem. Pass `data-readonly="false"` on
 * the script tag to make every block editable.
 */
import "./fts-playground.js"

const SELECTOR = [
  /* Prism, highlight.js, Chroma (Hugo): the language sits on the <code>. */
  "pre > code.language-fts",
  "pre > code.lang-fts",
  "pre > code.fts",
  'pre > code[data-lang="fts"]',
  /* Docusaurus and some Prism themes put it on the <pre>. */
  "pre.language-fts > code",
  "pre.fts > code",
  /* Shiki (VitePress) and Pygments (MkDocs) put it on the wrapper and leave the
     <code> unmarked, so the wrapper is the only place the language survives. */
  ".language-fts pre > code",
  ".lang-fts pre > code",
].join(", ")

const WRAPPER = /highlight|codeblock|code-block|highlighter|language-|lang-/i

/* Highlighters wrap the block in a figure or div carrying the code-block chrome
   — a copy button, a language label, a coloured frame. Replacing only the <pre>
   would leave that chrome around a playground it does not belong to, so the
   wrapper goes too, as long as it is chrome and not prose. */
function outermost(pre) {
  let node = pre
  while (node.parentElement) {
    const parent = node.parentElement
    const chrome =
      /^(FIGURE|DIV|SECTION|TD)$/.test(parent.tagName) &&
      WRAPPER.test(parent.className) &&
      parent.querySelectorAll("pre").length === 1 &&
      !parent.querySelector("h1, h2, h3, h4, h5, h6, p, ul, ol, table")
    if (!chrome) break
    node = parent
  }
  return node
}

function attributesFrom(options) {
  const attributes = { readonly: "" }
  for (const [key, value] of Object.entries(options)) {
    /* Options that steer this module, not the element. */
    if (value === null || value === undefined || key === "selector" || key === "observe" || key === "auto") continue
    if (key === "readonly") {
      if (String(value) === "false") delete attributes.readonly
      else attributes.readonly = ""
      continue
    }
    attributes[key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)] = String(value)
  }
  return attributes
}

/**
 * Replaces every matching code block with a playground.
 *
 * @param {object} [options] `view`, `readonly`, `theme`, `height`, `lang`,
 *   `runtime`, `mermaid` are forwarded to the element as attributes;
 *   `selector` overrides which blocks are picked up.
 * @returns {HTMLElement[]} the playgrounds that were created.
 */
export function upgrade(options = {}) {
  const selector = options.selector || SELECTOR
  const attributes = attributesFrom(options)
  const created = []
  for (const code of document.querySelectorAll(selector)) {
    const pre = code.closest("pre")
    if (!pre || pre.dataset.ftsUpgraded === "true") continue
    pre.dataset.ftsUpgraded = "true"
    const target = outermost(pre)
    const playground = document.createElement("fts-playground")
    for (const [name, value] of Object.entries(attributes)) playground.setAttribute(name, value)
    /* textContent, not innerHTML: the highlighter has already wrapped the model
       in spans, and the compiler needs the plain text the author wrote. */
    playground.textContent = code.textContent
    target.replaceWith(playground)
    created.push(playground)
  }
  return created
}

/* Options travel on the script tag, the way mermaid's `data-*` config does.
   `document.currentScript` is null inside a module, so the tag is found by its
   resolved URL instead. */
function ownScript() {
  for (const script of document.querySelectorAll("script[src]")) {
    if (script.src === import.meta.url) return script
  }
  return null
}

const script = ownScript()
const options = script ? { ...script.dataset } : {}

if (options.auto !== "false") {
  const start = () => {
    upgrade(options)
    /* Documentation sites swap the article without a page load (Docusaurus,
       VitePress, MkDocs Material's instant navigation). Watching the body keeps
       blocks that arrive later interactive without any per-framework glue. */
    if (options.observe !== "false") {
      let queued = false
      new MutationObserver(() => {
        /* One pass per frame. The observer sees its own replacements, and a
           direct re-scan on every record would walk the document far more often
           than a navigation needs. */
        if (queued) return
        queued = true
        requestAnimationFrame(() => {
          queued = false
          upgrade(options)
        })
      }).observe(document.body, { childList: true, subtree: true })
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true })
  else start()
}

globalThis.ftsAuto = { upgrade, selector: SELECTOR }

export default upgrade
