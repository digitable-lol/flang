# `<fts-playground>` — the FTS compiler as an embeddable element

The compiler has no dependencies and no server side, so the whole of it — parsing,
domain examples, executing a utility, generating TypeScript, proving a theorem
against data — fits in 88 KB of ES modules that run in the reader's tab. This
directory turns that into a custom element you embed the way you embed mermaid:

```html
<script type="module" src="/fts/fts-playground.js"></script>

<fts-playground view="run">
  категория «Продажи»

    объект Покупка
      сумма является деньгами
      «постоянный клиент» является признаком

    утилита «Рассчитать скидку»
      принимает Покупка
      возвращает деньги
      начинает с 0

      правило «Большая покупка»
        если сумма не меньше 10000
        то добавить 10 процентов от поля сумма
</fts-playground>
```

No build step, no npm install, no bundler, no configuration. Copy this folder to
wherever your site serves static files and add the script tag.

## What is here

| File | Purpose |
| --- | --- |
| `fts-playground.js` | the custom element; the only file you must load |
| `fts-auto.js` | replaces every ` ```fts ` code block on the page with a read-only playground |
| `fts-core.js` | the DOM-free logic (attributes, tabs, forms, diagnostics) the element renders |
| `fts-styles.js` | the stylesheet, injected into the shadow root |
| `vendor/fts/` | the browser build of the compiler, imported lazily |
| `demo/index.html` | every mode on one page |
| `scripts/vendor-runtime.mjs` | regenerates `vendor/fts/` from `dist/src` |
| `test/` | unit tests plus a headless-browser run |
| `fixtures/` | the pages and probes the browser test drives |

`vendor/fts/` is generated. After changing the compiler:

```sh
npm run build && node web/scripts/vendor-runtime.mjs
```

## Two ways to give it a model

**As text inside the tag** — the mermaid way. The indentation your HTML uses is
stripped before the compiler sees the model, so you can nest the tag anywhere.
Changing the text later (a docs site swapping an article, a framework re-render)
recompiles automatically.

**Over the network** — `src="models/discount.fts"`, resolved against the page URL.

```html
<fts-playground src="/models/order-shipment.fts"
                context-src="/models/order-shipment.context.json"
                view="proof" readonly></fts-playground>
```

## Attributes

| Attribute | Values | Meaning |
| --- | --- | --- |
| `src` | URL | load the model from a file instead of the tag's text |
| `context-src` | URL | JSON the theorem is proved against, for the proof tab |
| `view` | `check` `examples` `run` `typescript` `proof` `diagram` `model` | which tab opens first; also switches the tab when changed later |
| `views` | space or comma separated ids | narrow the tab strip, e.g. `views="check run"` |
| `readonly` | present / absent | show the model without an editor |
| `height` | CSS length or bare number (`440` = `440px`) | fixes the component's height; without it the component grows with its content |
| `theme` | `auto` (default) `light` `dark` | `auto` follows `prefers-color-scheme` |
| `lang` | `ru` `en` | interface language; by default it follows the page's `lang` |
| `eager` | present / absent | load the compiler immediately instead of waiting for the component to come into view |
| `runtime` | URL | a different build of the compiler |
| `mermaid` | URL | a mermaid bundle for the diagram tab (optional, see below) |

Every attribute is live: change it from JavaScript and the component reacts.

## Events

All three bubble and cross the shadow boundary, so `document.addEventListener`
is enough.

| Event | `detail` |
| --- | --- |
| `fts:ready` | `{ runtime }` — the compiler finished loading |
| `fts:compiled` | `{ model, document, valid, diagnostics, source, elapsed }` |
| `fts:error` | `{ message, diagnostics, source }` — a parse failure, a failed validation, or a model that could not be fetched |
| `fts:result` | `{ utility, input, value, elapsed }` after running a utility, `{ utility, input, error, diagnostics }` when a property is violated, `{ proof, context }` on the proof tab |

```js
document.addEventListener("fts:compiled", (event) => {
  console.log(event.target.id, event.detail.model.category, event.detail.valid)
})
```

## Scripting it

```js
const playground = document.querySelector("fts-playground")

playground.value = "категория «Продажи»\n  объект Покупка\n"  // set the model
const model = await playground.compile()                       // force load + compile
const discount = await playground.run("Рассчитать скидку", { сумма: 20000, "постоянный клиент": true })
playground.view = "proof"                                      // same as the attribute
playground.shareLink()                                         // URL carrying the current model
```

`FtsPlayground.defaults.runtime` and `FtsPlayground.defaults.mermaid` set the
page-wide defaults before any element upgrades.

## Lazy loading

The compiler is imported when the element scrolls into view (`IntersectionObserver`
with a 400 px margin), or as soon as the reader focuses the editor — typing tends
to outrun scrolling. A page with twenty models downloads the 88 KB once, shared
between every component, and only if a reader ever reaches one. `eager` opts out;
`compile()` forces it from script.

## Styling

The component renders into a shadow root, so the host page cannot restyle it and
it cannot restyle the host page — the point of the exercise, since documentation
themes style `pre`, `button` and `table` globally. Two channels stay open on
purpose:

```css
fts-playground {
  --fts-accent: #7c5cff;     /* also --fts-bg --fts-surface --fts-ink --fts-line
                                --fts-ok --fts-error --fts-mono --fts-font --fts-radius */
}
fts-playground::part(frame) { border-radius: 0; }   /* parts: frame editor output toolbar
                                                       filename button source status tabs
                                                       tab panel form result context */
```

## Accessibility

The tab strip is a real `role="tablist"` with `aria-selected`, arrow-key
navigation and roving `tabindex`; the editor has a `<label>`; the status line is
a live region; panels are focusable and labelled by their tab; animations are
dropped under `prefers-reduced-motion`.

## The diagram tab

The Mermaid *source* is always shown — any Mermaid viewer renders it. Drawing the
picture needs a Mermaid bundle, which is about a megabyte and is therefore never
loaded unless you ask for it:

```html
<fts-playground mermaid="/js/mermaid.min.js"></fts-playground>
<!-- or, once for the page: FtsPlayground.defaults.mermaid = "/js/mermaid.min.js" -->
```

If a page already has mermaid loaded (`window.mermaid`), it is used as is.

## Automatic upgrade of code blocks

```html
<script type="module" src="/fts/fts-auto.js" data-view="run"></script>
```

That single line turns every ` ```fts ` fence on the page into a read-only
playground, the way mermaid turns ` ```mermaid ` into a diagram. The markup of
Prism, Shiki, Pygments, Chroma and highlight.js is recognised, including the
wrapper each of them puts around the block. Blocks added later — documentation
sites that swap an article without a page load — are picked up too.

`data-*` attributes on the script tag are forwarded to every element, so
`data-view`, `data-theme`, `data-height`, `data-lang`, `data-runtime`,
`data-mermaid` and `data-readonly="false"` all work. `data-auto="false"` disables
the automatic pass (call `ftsAuto.upgrade(options)` yourself),
`data-observe="false"` stops watching for later blocks, and `data-selector` takes
over which blocks are matched.

## Integrations

Every recipe is the same two moves: **copy `web/` into whatever the generator
serves as static files, then add one script tag.** Nothing is compiled, so the
folder can also come from a CDN that mirrors this repository.

### Plain HTML

```html
<script type="module" src="/fts/fts-playground.js"></script>
<script type="module" src="/fts/fts-auto.js"></script>
<fts-playground view="run">категория «Продажи»
  объект Покупка
    сумма является деньгами</fts-playground>
```

### Hugo

Copy `web/` to `static/fts/`, then in `layouts/_default/baseof.html`:

```html
<script type="module" src="{{ "fts/fts-auto.js" | relURL }}" data-view="run"></script>
```

A shortcode makes it usable from Markdown — `layouts/shortcodes/fts.html`:

```html
<fts-playground view="{{ .Get "view" | default "check" }}"{{ with .Get "src" }} src="{{ . | relURL }}"{{ end }}{{ if .Get "readonly" }} readonly{{ end }}>{{ .Inner }}</fts-playground>
```

```markdown
{{</* fts view="run" */>}}
категория «Продажи»
  объект Покупка
    сумма является деньгами
{{</* /fts */>}}
```

### Docusaurus

Copy `web/` to `static/fts/`, then in `docusaurus.config.js`:

```js
module.exports = {
  scripts: [{ src: "/fts/fts-auto.js", type: "module", async: true, "data-view": "run" }],
}
```

Fenced ` ```fts ` blocks in MDX are upgraded automatically. To place a component
by hand, write the tag in MDX — MDX passes unknown lowercase tags through as
custom elements:

```mdx
<fts-playground src="/models/discount.fts" view="run"></fts-playground>
```

### MkDocs (Material)

Copy `web/` to `docs/js/fts/`. MkDocs 1.6+ can declare the module type directly:

```yaml
extra_javascript:
  - path: js/fts/fts-auto.js
    type: module
```

On MkDocs 1.5 an entry is a module only if it ends in `.mjs`, so add a one-line
`docs/js/fts-boot.mjs` containing `import "./fts/fts-auto.js"` and list that
instead. Material's instant navigation swaps the article without a page load;
`fts-auto.js` watches for that and upgrades the new blocks.

### VitePress

Copy `web/` to `public/fts/`, then in `.vitepress/config.js`:

```js
export default {
  head: [["script", { type: "module", src: "/fts/fts-auto.js", "data-view": "run" }]],
  vue: { template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("fts-") } } },
}
```

The `isCustomElement` line matters only if you write `<fts-playground>` in
Markdown by hand: without it Vue tries to resolve the tag as a component.

### Storybook

Point Storybook at this folder and load the element in the preview —
`.storybook/main.js`:

```js
export default { staticDirs: [{ from: "../web", to: "/fts" }] }
```

`.storybook/preview-head.html`:

```html
<script type="module" src="/fts/fts-playground.js"></script>
```

Then a story is just markup:

```js
export const Discount = { render: () => `<fts-playground view="run">${model}</fts-playground>` }
```

### Astro

Copy `web/` to `public/fts/` and keep the tag inline — Astro would otherwise try
to process and bundle the script:

```astro
<script is:inline type="module" src="/fts/fts-auto.js" data-view="run"></script>

<fts-playground view="run" set:html={model}></fts-playground>
```

### Reusing a compiler you already ship

If the site already serves `@digitable/fts`, point the element at that build and
drop `vendor/fts/` from the copy:

```html
<script type="module">
  import { FtsPlayground } from "/fts/fts-playground.js"
  FtsPlayground.defaults.runtime = "/node_modules/@digitable/fts/dist/src/browser.js"
</script>
```

Per component, the same thing is the `runtime` attribute. Importing the element
itself as `@digitable/fts/web/fts-playground.js` would need `./web/*` added to
the package's `exports` and `files`, which is a packaging decision outside this
folder.

## Tests

```sh
node --test web/test/core.test.mjs      # logic, no browser needed
node --test web/test/browser.test.mjs   # needs Chrome or Chromium
```

`core.test.mjs` covers what usually breaks and can be decided without a DOM:
dedenting the model out of the markup, attribute parsing, tab resolution, the
form built from an object's fields, and the way a thrown compiler error becomes
a list of diagnostics. It compiles real models with the vendored runtime rather
than a stub.

`browser.test.mjs` serves this folder over HTTP, drives the demo page in headless
Chrome and reads the result back out of the DOM (`FTS_PROBE_DUMP=1` prints
everything the browser saw). It covers both ways of supplying a model, the seven
tabs, keyboard navigation, error and recovery, the two themes, shadow-DOM
isolation against a deliberately hostile page, the events, and the upgrade of the
markup Prism, Shiki, Pygments, Chroma and highlight.js emit.

The plain-HTML path is verified end to end this way. The generator recipes above
are verified where it counts — the HTML those generators emit is exactly what the
fixture in `fixtures/highlighters.html` upgrades — but their configuration
files are written from each tool's documentation, not executed here.

## Limits

- `certify` and `verify` need Node.js cryptography and are not part of the
  browser surface: the playground proves theorems and shows the proof, but does
  not issue or check signed certificates.
- ES modules cannot be loaded over `file://`. Serve the folder
  (`python3 -m http.server`) or start Chrome with `--allow-file-access-from-files`;
  the demo page says so when it detects `file://`.
- The diagram tab draws a picture only when a Mermaid bundle is configured.
