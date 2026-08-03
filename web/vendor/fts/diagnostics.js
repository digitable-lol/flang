export class FtsError extends Error {
    diagnostics;
    constructor(message, diagnostics) {
        super(message);
        this.name = "FtsError";
        this.diagnostics = diagnostics;
    }
}
export function diagnosticError(code, message, options = {}) {
    const diagnostic = { code, message, severity: "error" };
    if (options.path !== undefined)
        diagnostic.path = options.path;
    if (options.span !== undefined)
        diagnostic.span = options.span;
    return new FtsError(message, [diagnostic]);
}
export function errorResult(error) {
    if (error instanceof FtsError) {
        return { error: error.message, diagnostics: error.diagnostics };
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
        error: message,
        diagnostics: [{ code: "FTS_INTERNAL", message, severity: "error" }],
    };
}
