export function witnessDocument(options) {
    const proposition = {
        kind: "witness",
        structure: options.structure,
        field: options.field,
    };
    if (options.selector !== undefined)
        proposition.selector = options.selector;
    if (options.value !== undefined)
        proposition.value = options.value;
    if (options.path !== undefined)
        proposition.path = options.path;
    if (options.detail !== undefined)
        proposition.detail = options.detail;
    return {
        category: options.category,
        structures: options.structures,
        functors: [],
        proposition,
        ts_compat: {},
    };
}
export function composeDocument(options) {
    return {
        category: options.category,
        structures: options.structures ?? [],
        functors: options.functors,
        proposition: { kind: "compose", functors: options.chain, arg: options.arg },
        ts_compat: {},
    };
}
