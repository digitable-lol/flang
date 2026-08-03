/**
 * The stylesheet of <fts-playground>, exported as a string.
 *
 * It is injected into the shadow root, never into the page: a playground dropped
 * into somebody else's documentation must not restyle that documentation, and
 * the documentation must not restyle the playground. Everything is expressed
 * through custom properties declared on :host, so a host page that *wants* to
 * theme the component can still set `--fts-accent` and friends from outside —
 * that is the one channel left open on purpose.
 */
export const styles = `
:host {
  --fts-font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --fts-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --fts-radius: 12px;
  --fts-bg: #ffffff;
  --fts-surface: #f6f7f9;
  --fts-sunken: #eceef2;
  --fts-ink: #14181f;
  --fts-muted: #5d6675;
  --fts-line: #d8dce4;
  --fts-accent: #0b6bcb;
  --fts-accent-ink: #ffffff;
  --fts-ok: #0f7b3f;
  --fts-error: #b3261e;
  --fts-busy: #8a6d00;

  display: block;
  contain: content;
  container-type: inline-size;
  color-scheme: light;
  font-family: var(--fts-font);
  font-size: 15px;
  line-height: 1.5;
  color: var(--fts-ink);
}

/* Theme resolution order: an explicit theme attribute always wins, and only the
   automatic mode listens to the reader's system preference. */
@media (prefers-color-scheme: dark) {
  :host(:not([theme="light"])) {
    --fts-bg: #10141b;
    --fts-surface: #161c26;
    --fts-sunken: #0b0f15;
    --fts-ink: #e6ebf2;
    --fts-muted: #97a3b4;
    --fts-line: #28313f;
    --fts-accent: #6ab7ff;
    --fts-accent-ink: #0b0f15;
    --fts-ok: #57d38c;
    --fts-error: #ff8a80;
    --fts-busy: #ffcc66;
    color-scheme: dark;
  }
}

:host([theme="dark"]) {
  --fts-bg: #10141b;
  --fts-surface: #161c26;
  --fts-sunken: #0b0f15;
  --fts-ink: #e6ebf2;
  --fts-muted: #97a3b4;
  --fts-line: #28313f;
  --fts-accent: #6ab7ff;
  --fts-accent-ink: #0b0f15;
  --fts-ok: #57d38c;
  --fts-error: #ff8a80;
  --fts-busy: #ffcc66;
  color-scheme: dark;
}

:host([hidden]) { display: none; }

* { box-sizing: border-box; }

.frame {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  /* A single row that may shrink below its content. Without it a frame with a
     fixed height would let the panes keep their natural size and spill out. */
  grid-template-rows: minmax(0, 1fr);
  gap: 1px;
  background: var(--fts-line);
  border: 1px solid var(--fts-line);
  border-radius: var(--fts-radius);
  overflow: hidden;
}

/* Narrow enough — a sidebar column, a phone — and the two panes stack. The
   editor then takes what it needs and the results take the rest, so a fixed
   height still holds. */
@container (max-width: 720px) {
  .frame {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, auto) minmax(0, 1fr);
  }
}

.pane {
  background: var(--fts-bg);
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.bar {
  /* Chrome, not content: the toolbar, the tab strip and the status line keep
     their size when the frame is short, and the panel scrolls instead. */
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 10px;
  background: var(--fts-surface);
  border-bottom: 1px solid var(--fts-line);
  font-size: 12px;
}

.name {
  font-family: var(--fts-mono);
  color: var(--fts-muted);
  margin-right: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

button {
  font: inherit;
  font-size: 12px;
  color: var(--fts-ink);
  background: var(--fts-bg);
  border: 1px solid var(--fts-line);
  border-radius: 999px;
  padding: 4px 11px;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease;
}

button:hover { border-color: var(--fts-accent); }
button:focus-visible,
textarea:focus-visible,
input:focus-visible,
select:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--fts-accent);
  outline-offset: 2px;
}

.editor {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}

textarea,
pre.source {
  flex: 1 1 auto;
  width: 100%;
  margin: 0;
  padding: 12px 14px;
  border: 0;
  resize: vertical;
  background: var(--fts-bg);
  color: var(--fts-ink);
  font-family: var(--fts-mono);
  font-size: 13px;
  line-height: 1.6;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
}

/* A free-standing playground needs a usable editor; one with an explicit height
   must respect that height instead, and lets the editor scroll. */
:host(:not([height])) textarea { min-height: 220px; }
textarea, pre.source { min-height: 0; }

.status {
  flex: 0 0 auto;
  padding: 7px 12px;
  border-top: 1px solid var(--fts-line);
  background: var(--fts-surface);
  font-size: 12px;
  color: var(--fts-muted);
}

.status[data-tone="ok"] { color: var(--fts-ok); }
.status[data-tone="error"] { color: var(--fts-error); }
.status[data-tone="busy"] { color: var(--fts-busy); }

[role="tablist"] {
  flex: 0 0 auto;
  display: flex;
  gap: 2px;
  overflow-x: auto;
  padding: 6px 6px 0;
  background: var(--fts-surface);
  border-bottom: 1px solid var(--fts-line);
  scrollbar-width: thin;
}

[role="tab"] {
  border: 0;
  border-radius: 8px 8px 0 0;
  background: transparent;
  color: var(--fts-muted);
  padding: 6px 12px;
  white-space: nowrap;
}

[role="tab"][aria-selected="true"] {
  background: var(--fts-bg);
  color: var(--fts-ink);
  box-shadow: inset 0 -2px 0 var(--fts-accent);
}

[role="tabpanel"] {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 14px;
}

[role="tabpanel"][hidden] { display: none; }

.empty {
  margin: 0;
  color: var(--fts-muted);
  font-size: 13px;
}

.hint {
  margin: 12px 0 0;
  color: var(--fts-muted);
  font-size: 12px;
}

code, .mono { font-family: var(--fts-mono); }

dl.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin: 0;
}

dl.facts > div {
  background: var(--fts-surface);
  border: 1px solid var(--fts-line);
  border-radius: 10px;
  padding: 8px 10px;
  min-width: 0;
}

dl.facts dt {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fts-muted);
}

dl.facts dd {
  margin: 2px 0 0;
  font-family: var(--fts-mono);
  font-size: 14px;
  overflow-wrap: anywhere;
}

ul.diagnostics {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

ul.diagnostics li {
  display: grid;
  gap: 2px;
  border-left: 3px solid var(--fts-error);
  background: var(--fts-surface);
  border-radius: 0 8px 8px 0;
  padding: 8px 10px;
}

ul.diagnostics b {
  font-family: var(--fts-mono);
  font-size: 11px;
  color: var(--fts-error);
}

ul.diagnostics small { color: var(--fts-muted); font-size: 11px; }

.verdict {
  margin: 0 0 12px;
  font-weight: 600;
}

.verdict[data-tone="ok"] { color: var(--fts-ok); }
.verdict[data-tone="error"] { color: var(--fts-error); }

table {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}

th, td {
  text-align: left;
  padding: 6px 8px;
  border-bottom: 1px solid var(--fts-line);
  vertical-align: top;
}

th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--fts-muted); }
td:first-child { width: 1.5em; font-family: var(--fts-mono); }
tr.pass td:first-child { color: var(--fts-ok); }
tr.fail td:first-child { color: var(--fts-error); }

.scroll { overflow-x: auto; }

form.run { display: grid; gap: 12px; }

fieldset {
  border: 1px solid var(--fts-line);
  border-radius: 10px;
  padding: 10px 12px 12px;
  margin: 0;
  display: grid;
  gap: 10px;
}

legend { font-size: 12px; color: var(--fts-muted); padding: 0 4px; }

label.field, label.utility {
  display: grid;
  gap: 3px;
  font-size: 12px;
  color: var(--fts-muted);
}

label.check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--fts-muted);
}

label.check span, label.field > span, label.utility > span { color: var(--fts-ink); font-size: 13px; }
label small { font-family: var(--fts-mono); font-size: 11px; color: var(--fts-muted); }

input[type="text"],
input[type="number"],
input[type="date"],
select,
textarea.context {
  font: inherit;
  font-size: 13px;
  padding: 6px 8px;
  border: 1px solid var(--fts-line);
  border-radius: 8px;
  background: var(--fts-bg);
  color: var(--fts-ink);
  width: 100%;
}

textarea.context {
  font-family: var(--fts-mono);
  min-height: 120px;
  resize: vertical;
}

label.context { display: grid; gap: 4px; margin-bottom: 12px; font-size: 12px; color: var(--fts-muted); }

output.result {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--fts-line);
  background: var(--fts-surface);
}

output.result strong { font-family: var(--fts-mono); font-size: 18px; }
output.result[data-tone="ok"] strong { color: var(--fts-ok); }
output.result[data-tone="error"] strong { color: var(--fts-error); font-size: 14px; }
output.result small { color: var(--fts-muted); font-size: 11px; overflow-wrap: anywhere; }

figure.generated { margin: 0 0 14px; }
figure.generated figcaption { font-family: var(--fts-mono); font-size: 11px; color: var(--fts-muted); margin-bottom: 4px; }

pre.code {
  margin: 0;
  padding: 10px 12px;
  background: var(--fts-sunken);
  border: 1px solid var(--fts-line);
  border-radius: 10px;
  overflow: auto;
  font-family: var(--fts-mono);
  font-size: 12px;
  line-height: 1.55;
}

.diagram { display: grid; justify-items: center; }
.diagram svg { max-width: 100%; height: auto; }
details.diagram-source { margin-top: 12px; }
details.diagram-source summary { cursor: pointer; font-size: 12px; color: var(--fts-muted); }

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
}
`
