/**
 * Formatting and escaping for GitHub Actions "workflow commands"
 * (`::error ...::...`, `::warning ...::...`), the mechanism the runner uses to
 * turn a line printed on stdout into an inline annotation on the diff.
 *
 * Reimplemented here (instead of depending on `@actions/core`) because the
 * whole surface we need is: two escaping functions and one string template.
 * See https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
 *
 * Escaping rules, straight from the runner's own source:
 *   - command message: '%' -> '%25', '\r' -> '%0D', '\n' -> '%0A'
 *   - command property value: the same, plus ':' -> '%3A', ',' -> '%2C'
 * The '%' substitution must run first, or the '%0D'/'%0A'/'%3A'/'%2C' produced
 * by the later substitutions would themselves get mangled.
 */

export function escapeData(value) {
  return String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A")
}

export function escapeProperty(value) {
  return escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C")
}

/**
 * Build one workflow command line, e.g.
 *   ::error file=a.fts,line=3,col=1::message here
 *
 * `properties` values that are `undefined` or `null` are omitted entirely
 * (GitHub does not want empty `line=` params). Property order follows
 * insertion order of the object.
 */
export function formatCommand(command, properties, message) {
  const parts = Object.entries(properties ?? {})
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${escapeProperty(value)}`)
  const header = parts.length > 0 ? `::${command} ${parts.join(",")}::` : `::${command}::`
  return `${header}${escapeData(message)}`
}
