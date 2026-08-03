/** Human-facing object view over the version-1 canonical wire model. */
export function objects(document) {
    return document.structures;
}
/** Human-facing morphism view over the legacy `functors` wire field. */
export function morphisms(document) {
    return document.functors;
}
/** Human-facing theorem view over the legacy `proposition` wire field. */
export function theorem(document) {
    return document.proposition;
}
