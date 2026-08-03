/**
 * Reports what fts-auto.js made of the highlighter fixtures.
 *
 * Each generator's markup carries a different category name, so the compiled
 * categories say exactly which shapes were recognised — and the surviving code
 * blocks say which ones were missed.
 */
const state = { categories: [], leftover: [], steps: [] }
const out = document.createElement("pre")
out.id = "fts-probe"
out.hidden = true
document.body.append(out)

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

try {
  await customElements.whenDefined("fts-playground")
  const playgrounds = [...document.querySelectorAll("fts-playground")]
  state.count = playgrounds.length
  for (const playground of playgrounds) {
    for (let attempt = 0; attempt < 400 && !playground.dataset.ftsRenders; attempt += 1) await sleep(25)
    state.categories.push(playground.model ? playground.model.category : `NOT COMPILED: ${playground.value.slice(0, 30)}`)
  }
  state.categories.sort()
  for (const code of document.querySelectorAll("pre code")) state.leftover.push(code.className || "(no class)")
  state.readonly = playgrounds.every((playground) => playground.hasAttribute("readonly"))
  state.view = playgrounds[0]?.getAttribute("view")
  /* The chrome of the original block must be gone with it: no orphan copy
     buttons or language labels left standing next to the playground. */
  state.orphans = document.querySelectorAll("button.copy, span.lang, .buttonGroup_GkgW").length
  state.ok = true
} catch (error) {
  state.ok = false
  state.error = String(error && error.message ? error.message : error)
}

out.textContent = JSON.stringify(state)
